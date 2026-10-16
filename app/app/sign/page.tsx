"use client";

import { ml_dsa44 } from "@noble/post-quantum/ml-dsa.js";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { bytesToHex, hexToBytes } from "@/lib/seed";
import { playTransaction } from "@/lib/sound";
import { stepNames, type PreparedSpend } from "@/lib/spend";
import { refreshWallet } from "@/lib/use-wallet";
import { readWallets, type SavedWallet } from "@/lib/wallets";
import { TokenLogo } from "../token-modal";
import { WalletAvatar } from "../wallet-avatar";

type State =
  | { phase: "loading" }
  | { phase: "ready"; prepared: PreparedSpend; wallet: SavedWallet }
  | { phase: "signing" | "sending"; prepared: PreparedSpend; wallet: SavedWallet }
  | { phase: "done"; prepared: PreparedSpend; wallet: SavedWallet; hash: string }
  | { phase: "error"; message: string; prepared?: PreparedSpend; wallet?: SavedWallet };

function short(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
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

function TokenMark({ src, alt, size = "h-12 w-12" }: { src: string; alt: string; size?: string }) {
  return <TokenLogo token={{ logo: src, symbol: alt }} className={`${size} ring-1 ring-black/5`} />;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <dt className="text-[13px] text-[#8a8a8a]">{label}</dt>
      <dd className="min-w-0 text-right text-[14px] font-medium">{children}</dd>
    </div>
  );
}

function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />;
}

function Shield() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3 L19 6 V11.5 C19 16 16 19.2 12 21 C8 19.2 5 16 5 11.5 V6 Z" />
      <path d="M9 12 L11.2 14.2 L15.2 10" />
    </svg>
  );
}

function Glyph({ kind }: { kind: string }) {
  const path =
    kind === "send"
      ? "M7 17 L17 7 M9 7 H17 V15"
      : kind === "swap"
        ? "M7 8 H17 M17 8 L14 5 M17 16 H7 M7 16 L10 19"
        : "M12 5 V15 M8 11 L12 15 L16 11 M6 19 H18";
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-white">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </span>
  );
}

function Skeleton() {
  return (
    <div className="glass rounded-[32px] p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="sign-shimmer h-11 w-11 rounded-full" />
        <div className="space-y-2">
          <span className="sign-shimmer block h-4 w-28 rounded-full" />
          <span className="sign-shimmer block h-3 w-20 rounded-full" />
        </div>
      </div>
      <span className="sign-shimmer mx-auto mt-10 block h-12 w-48 rounded-2xl" />
      <span className="sign-shimmer mx-auto mt-3 block h-4 w-24 rounded-full" />
      <div className="mt-10 space-y-2">
        {[0, 1, 2, 3].map((row) => (
          <span key={row} className="sign-shimmer block h-11 rounded-2xl" />
        ))}
      </div>
      <p className="mt-6 text-center text-[13px] text-[#8a8a8a]">Building the batch on Robinhood Chain</p>
    </div>
  );
}

function Review() {
  const params = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<State>({ phase: "loading" });
  const [showSteps, setShowSteps] = useState(false);
  const [copied, setCopied] = useState(false);
  const query = params.toString();
  const now = useNow(state.phase === "ready");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const store = readWallets();
      const wallet = store.wallets.find((item) => item.id === store.activeId);
      if (!wallet?.address) {
        if (!cancelled) setState({ phase: "error", message: "This wallet has no account yet." });
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
          body = text ? (JSON.parse(text) as PreparedSpend & { error?: string }) : { error: "This could not be prepared." };
        } catch {
          body = { error: "This could not be prepared." };
        }
        if (cancelled) return;
        if (!response.ok || body.error || !("steps" in body)) {
          setState({ phase: "error", message: body.error || "This could not be prepared.", wallet });
        } else {
          setState({ phase: "ready", prepared: body, wallet });
        }
      } catch {
        if (!cancelled) setState({ phase: "error", message: "Robinhood Chain did not answer.", wallet });
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
      setState({ phase: "error", message: "Unlock the wallet to sign.", prepared, wallet });
      return;
    }
    setState({ phase: "signing", prepared, wallet });
    await new Promise((resolve) => setTimeout(resolve, 30));
    let signature: string;
    try {
      const keys = ml_dsa44.keygen(hexToBytes(wallet.seed));
      signature = `0x${bytesToHex(ml_dsa44.sign(hexToBytes(prepared.message.slice(2)), keys.secretKey))}`;
    } catch {
      setState({ phase: "error", message: "This device could not sign.", prepared, wallet });
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
        setState({ phase: "error", message: body.error || "This transaction was not sent.", prepared, wallet });
        return;
      }
      playTransaction();
      void refreshWallet(true);
      setState({ phase: "done", prepared, wallet, hash: body.hash });
    } catch {
      setState({ phase: "error", message: "Robinhood Chain did not answer.", prepared, wallet });
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

  if (state.phase === "loading") {
    return (
      <div className="mx-auto max-w-[480px]">
        <Skeleton />
      </div>
    );
  }

  if (state.phase === "done") {
    const { summary } = state.prepared;
    return (
      <div className="mx-auto max-w-[480px]">
        <div className="glass sign-rise rounded-[32px] px-6 py-10 text-center">
          <span className="sign-pop mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-black text-white shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5 L10 17.5 L19 7.5" />
            </svg>
          </span>
          <h1 className="mt-6 text-[1.8rem] font-medium tracking-[-0.03em]">
            {{ Send: "Sent", Swap: "Swapped", Wrap: "Wrapped", Unwrap: "Unwrapped", Supply: "Supplied", Deposit: "Deposited" }[summary.title] ?? "Done"}
          </h1>
          <p className="mt-2 text-[15px] text-[#6a6a6a]">
            {summary.pay.amount} {summary.pay.symbol}
            {summary.receive ? ` for about ${summary.receive.amount} ${summary.receive.symbol}` : ""}
            {summary.to.address ? ` to ${short(summary.to.address)}` : ""}
          </p>
          <button
            type="button"
            onClick={() => copyHash(state.hash)}
            className="glass-field mx-auto mt-6 flex items-center gap-2 rounded-full px-4 py-2 text-[13px]"
          >
            <span className="text-[#8a8a8a]">Transaction</span>
            <span className="font-medium">{short(state.hash)}</span>
            <span className="text-[#8a8a8a]">{copied ? "Copied" : "Copy"}</span>
          </button>
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="mt-8 h-12 w-full rounded-full bg-black text-[15px] font-medium text-white"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const prepared = "prepared" in state ? state.prepared : undefined;
  const wallet = "wallet" in state ? state.wallet : undefined;

  if (!prepared) {
    return (
      <div className="mx-auto max-w-[480px]">
        <div className="glass sign-rise rounded-[32px] px-6 py-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/70 text-[22px]">!</span>
          <h1 className="mt-5 text-[1.4rem] font-medium tracking-[-0.03em]">This can&apos;t be signed</h1>
          <p className="mx-auto mt-2 max-w-[320px] text-[14px] leading-6 text-[#6a6a6a]">{state.phase === "error" ? state.message : ""}</p>
          <button type="button" onClick={() => router.back()} className="mt-8 h-12 w-full rounded-full bg-black text-[15px] font-medium text-white">
            Go back
          </button>
        </div>
      </div>
    );
  }

  const { summary } = prepared;
  const left = Math.max(0, prepared.deadline - now);
  const expired = state.phase === "ready" && left === 0;
  const busy = state.phase === "signing" || state.phase === "sending";
  const title = `Confirm ${summary.title.toLowerCase()}`;

  return (
    <div className="mx-auto max-w-[480px]">
      <div className="glass sign-rise rounded-[32px] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <Glyph kind={summary.kind} />
          <div className="min-w-0 flex-1">
            <h1 className="text-[17px] font-medium tracking-[-0.01em]">{title}</h1>
            <p className="text-[13px] text-[#8a8a8a]">Robinhood Chain</p>
          </div>
          {wallet ? (
            <span className="glass-field flex items-center gap-2 rounded-full py-1 pl-1 pr-3">
              <WalletAvatar seed={wallet.avatar} className="h-7 w-7" />
              <span className="text-[12px] font-medium">{short(wallet.address)}</span>
            </span>
          ) : null}
        </div>

        <div className="mt-8 text-center">
          {summary.receive ? (
            <div className="space-y-2">
              <div className="glass-field flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left">
                <TokenMark src={summary.pay.logo} alt={summary.pay.symbol} size="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-[#8a8a8a]">You pay</p>
                  <p className="truncate text-[1.5rem] font-medium leading-tight tracking-[-0.03em]">
                    {summary.pay.amount} <span className="text-[#9a9a9a]">{summary.pay.symbol}</span>
                  </p>
                </div>
              </div>
              <div className="relative h-0">
                <span className="glass absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <path d="M12 5 V19 M6 13 L12 19 L18 13" />
                  </svg>
                </span>
              </div>
              <div className="glass-field flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left">
                <TokenMark src={summary.receive.logo} alt={summary.receive.symbol} size="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-[#8a8a8a]">You receive about</p>
                  <p className="truncate text-[1.5rem] font-medium leading-tight tracking-[-0.03em]">
                    {summary.receive.amount} <span className="text-[#9a9a9a]">{summary.receive.symbol}</span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <TokenMark src={summary.pay.logo} alt={summary.pay.symbol} size="mx-auto h-14 w-14" />
              <p className="mt-4 break-all text-[2.6rem] font-medium leading-none tracking-[-0.05em]">
                {summary.pay.amount} <span className="text-[#a3a3a3]">{summary.pay.symbol}</span>
              </p>
              <p className="mt-3 text-[14px] text-[#8a8a8a]">
                {summary.to.address ? (
                  <>
                    to <span className="font-medium text-[#111]">{short(summary.to.address)}</span>
                  </>
                ) : (
                  summary.route
                )}
              </p>
            </>
          )}
        </div>

        <dl className="glass-field mt-6 divide-y divide-white/60 rounded-2xl">
          {summary.to.address ? (
            <Detail label="To">
              <span className="font-mono text-[12.5px]">{short(summary.to.address)}</span>
            </Detail>
          ) : null}
          {summary.receive ? <Detail label="Minimum received">{`${summary.receive.minimum} ${summary.receive.symbol}`}</Detail> : null}
          {summary.route && summary.receive ? <Detail label="Route">{summary.route}</Detail> : null}
          <Detail label={`Ketra fee · ${summary.fee.rate}`}>{`${summary.fee.amount} ${summary.fee.symbol}`}</Detail>
          <Detail label="Network fee">
            <span className="rounded-full bg-black px-2.5 py-1 text-[11px] font-medium text-white">Covered</span>
          </Detail>
          <Detail label="Expires">
            <span className={left < 60 ? "text-[#b4471c]" : ""}>{expired ? "Expired" : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}</span>
          </Detail>
        </dl>

        <button
          type="button"
          onClick={() => setShowSteps((open) => !open)}
          className="mt-3 flex w-full items-center justify-between rounded-2xl px-4 py-2.5 text-[13px] text-[#6a6a6a]"
        >
          <span>
            {prepared.steps.length} step{prepared.steps.length === 1 ? "" : "s"} · nonce {prepared.nonce}
          </span>
          <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${showSteps ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 9 L12 15 L18 9" />
          </svg>
        </button>
        {showSteps ? (
          <ol className="sign-rise mb-1 space-y-1.5 px-1">
            {prepared.steps.map((step, index) => (
              <li key={index} className="glass-item flex items-center gap-3 rounded-xl px-3 py-2 text-[13px]">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/80 text-[10px] text-white">{index + 1}</span>
                <span>{stepNames[step.action] ?? `Action ${step.action}`}</span>
              </li>
            ))}
          </ol>
        ) : null}

        <div className="mt-3 flex items-start gap-2.5 rounded-2xl bg-black/[0.04] px-4 py-3 text-[12.5px] leading-5 text-[#555]">
          <span className="mt-0.5 text-[#111]">
            <Shield />
          </span>
          <span>Signed on this device with ML-DSA-44. The seed phrase never leaves this browser. The network fee is paid for you and cannot change this batch.</span>
        </div>

        {state.phase === "error" ? (
          <p className="sign-rise mt-4 rounded-2xl bg-[#b4471c]/10 px-4 py-3 text-[13px] leading-5 text-[#8a3413]">{state.message}</p>
        ) : null}

        <div className="mt-5 grid grid-cols-[1fr_1.6fr] gap-2.5">
          <Link href="/" className="glass-field flex h-12 items-center justify-center rounded-full text-[15px] font-medium">
            Cancel
          </Link>
          {state.phase === "error" ? (
            <button type="button" onClick={() => window.location.reload()} className="h-12 rounded-full bg-black text-[15px] font-medium text-white">
              Review again
            </button>
          ) : (
            <button
              type="button"
              onClick={sign}
              disabled={busy || expired}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-black text-[15px] font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? <Spinner /> : null}
              {state.phase === "signing" ? "Signing" : state.phase === "sending" ? "Sending" : expired ? "Expired" : "Sign and send"}
            </button>
          )}
        </div>
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
