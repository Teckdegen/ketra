"use client";

import { ml_dsa44 } from "@noble/post-quantum/ml-dsa.js";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { bytesToHex, hexToBytes } from "@/lib/seed";
import { playTransaction } from "@/lib/sound";
import type { PreparedSpend } from "@/lib/spend";
import { refreshWallet } from "@/lib/use-wallet";
import { readWallets, type SavedWallet } from "@/lib/wallets";

type State =
  | { phase: "loading" }
  | { phase: "ready"; prepared: PreparedSpend; wallet: SavedWallet }
  | { phase: "signing" | "sending"; prepared: PreparedSpend; wallet: SavedWallet }
  | { phase: "done"; prepared: PreparedSpend; wallet: SavedWallet; hash: string }
  | { phase: "error"; message: string; prepared?: PreparedSpend; wallet?: SavedWallet };

function short(value: string) {
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-black/8 py-4">
      <p className="text-[13px] text-[#8a8a8a]">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-3 text-[16px] font-medium">{children}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-md px-1">
      <span className="sign-shimmer mx-auto mt-16 block h-12 w-40 rounded-2xl" />
      <div className="mt-16 space-y-3">
        {[0, 1, 2].map((row) => (
          <span key={row} className="sign-shimmer block h-14 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function Review() {
  const params = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<State>({ phase: "loading" });
  const [copied, setCopied] = useState(false);
  const query = params.toString();
  const now = useNow(state.phase === "ready");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const store = readWallets();
      const wallet = store.wallets.find((item) => item.id === store.activeId);
      if (!wallet?.address) {
        if (!cancelled) setState({ phase: "error", message: "No account yet." });
        return;
      }
      const values = Object.fromEntries(new URLSearchParams(query));
      try {
        const response = await fetch("/api/spend/prepare", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...values, account: wallet.address }),
        });
        const text = await response.text();
        let body: (PreparedSpend & { error?: string }) | { error: string };
        try {
          body = text ? (JSON.parse(text) as PreparedSpend & { error?: string }) : { error: "Could not prepare." };
        } catch {
          body = { error: "Could not prepare." };
        }
        if (cancelled) return;
        if (!response.ok || body.error || !("steps" in body)) {
          setState({ phase: "error", message: body.error || "Could not prepare.", wallet });
        } else {
          setState({ phase: "ready", prepared: body, wallet });
        }
      } catch {
        if (!cancelled) setState({ phase: "error", message: "Network did not answer.", wallet });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [query]);

  async function sign() {
    if (state.phase !== "ready") return;
    const { prepared, wallet } = state;
    if (!/^[0-9a-f]{64}$/.test(wallet.seed)) {
      setState({ phase: "error", message: "Unlock to sign.", prepared, wallet });
      return;
    }
    setState({ phase: "signing", prepared, wallet });
    await new Promise((resolve) => setTimeout(resolve, 30));
    let signature: string;
    try {
      const keys = ml_dsa44.keygen(hexToBytes(wallet.seed));
      signature = `0x${bytesToHex(ml_dsa44.sign(hexToBytes(prepared.message.slice(2)), keys.secretKey))}`;
    } catch {
      setState({ phase: "error", message: "Could not sign.", prepared, wallet });
      return;
    }
    setState({ phase: "sending", prepared, wallet });
    try {
      const response = await fetch("/api/spend/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          account: wallet.address,
          nonce: prepared.nonce,
          deadline: prepared.deadline,
          steps: prepared.steps,
          signature,
        }),
      });
      const body = (await response.json()) as { hash?: string; error?: string };
      if (!response.ok || !body.hash) {
        setState({ phase: "error", message: body.error || "Not sent.", prepared, wallet });
        return;
      }
      playTransaction();
      void refreshWallet(true);
      setState({ phase: "done", prepared, wallet, hash: body.hash });
    } catch {
      setState({ phase: "error", message: "Network did not answer.", prepared, wallet });
    }
  }

  async function copyHash(hash: string) {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  if (state.phase === "loading") return <Skeleton />;

  if (state.phase === "done") {
    const { summary } = state.prepared;
    return (
      <div className="mx-auto max-w-md">
        <div className="pt-10 text-center">
          <p className="text-[2.8rem] font-medium tracking-[-0.05em] leading-none">
            {summary.receive ? summary.receive.amount : summary.pay.amount}
          </p>
          <p className="mt-3 text-[15px] text-[#8a8a8a]">
            {summary.receive ? summary.receive.symbol : summary.pay.symbol} · {short(state.hash)}
          </p>
          <button type="button" onClick={() => void copyHash(state.hash)} className="mt-6 text-[13px] text-[#8a8a8a] underline decoration-[#ddd] underline-offset-2">
            {copied ? "Copied" : "Copy hash"}
          </button>
          <button type="button" onClick={() => router.replace("/")} className="mt-10 h-12 w-full rounded-full bg-black text-[15px] font-medium text-white">
            Done
          </button>
        </div>
      </div>
    );
  }

  const prepared = "prepared" in state ? state.prepared : undefined;

  if (!prepared) {
    return (
      <div className="mx-auto max-w-md pt-16 text-center">
        <h1 className="text-[1.5rem] font-medium tracking-[-0.03em]">Can&apos;t sign</h1>
        <p className="mt-3 text-[14px] text-[#8a8a8a]">{state.phase === "error" ? state.message : ""}</p>
        <button type="button" onClick={() => router.back()} className="mt-8 h-12 w-full rounded-full bg-black text-[15px] font-medium text-white">
          Back
        </button>
      </div>
    );
  }

  const { summary } = prepared;
  const left = Math.max(0, prepared.deadline - now);
  const expired = state.phase === "ready" && left === 0;
  const busy = state.phase === "signing" || state.phase === "sending";
  const withdrawing = summary.kind === "morpho-withdraw" || summary.kind === "steakhouse-withdraw";
  const headline =
    (summary.kind === "swap" || withdrawing) && summary.receive
      ? summary.receive.amount
      : summary.pay.amount;
  const headlineUnit =
    (summary.kind === "swap" || withdrawing) && summary.receive ? summary.receive.symbol : summary.pay.symbol;

  return (
    <div className="mx-auto max-w-md">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="glass-field flex h-10 w-10 items-center justify-center rounded-full"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M15 6 L9 12 L15 18" />
          </svg>
        </button>
        <h1 className="flex-1 pr-10 text-center text-[16px] font-medium tracking-[-0.02em]">Review {summary.title}</h1>
      </div>

      <p className="mt-14 text-center text-[3rem] font-medium leading-none tracking-[-0.05em]">
        {headline} <span className="text-[#a3a3a3]">{headlineUnit}</span>
      </p>

      <div className="mt-14">
        {summary.to.address ? (
          <Row label="Recipient">
            <span className="font-mono">{short(summary.to.address)}</span>
          </Row>
        ) : summary.receive && !withdrawing ? (
          <Row label="Receive">
            <span>
              {summary.receive.amount} {summary.receive.symbol}
            </span>
          </Row>
        ) : null}

        <Row label={summary.kind === "send" ? "Payment" : withdrawing ? "Withdraw" : "Pay"}>
          <span>
            {summary.pay.amount} {summary.pay.symbol}
            <span className="text-[#8a8a8a]"> · {summary.fee.rate} fee</span>
          </span>
        </Row>

        {summary.kind === "send" ? (
          <Row label="Sending">
            <span>
              {summary.pay.amount} {summary.pay.symbol}
            </span>
          </Row>
        ) : withdrawing && summary.receive ? (
          <Row label="You get">
            <span>
              {summary.receive.amount} {summary.receive.symbol}
            </span>
          </Row>
        ) : summary.receive ? (
          <Row label="Minimum">
            <span>
              {summary.receive.minimum} {summary.receive.symbol}
            </span>
          </Row>
        ) : (
          <Row label="Into">
            <span>{summary.title}</span>
          </Row>
        )}

        <Row label="Expires">
          <span className={left < 60 ? "text-[#b4471c]" : ""}>
            {expired ? "Expired" : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}
          </span>
        </Row>
      </div>

      {state.phase === "error" ? <p className="mt-4 text-[13px] text-[#b4471c]">{state.message}</p> : null}

      <div className="mt-10">
        {state.phase === "error" ? (
          <button type="button" onClick={() => window.location.reload()} className="h-12 w-full rounded-full bg-black text-[15px] font-medium text-white">
            Try again
          </button>
        ) : (
          <button
            type="button"
            onClick={sign}
            disabled={busy || expired}
            className="h-12 w-full rounded-full bg-black text-[15px] font-medium text-white disabled:opacity-50"
          >
            {state.phase === "signing" ? "Signing" : state.phase === "sending" ? "Sending" : expired ? "Expired" : "Confirm"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Sign() {
  return (
    <Suspense>
      <Review />
    </Suspense>
  );
}
