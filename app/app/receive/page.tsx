"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ml_dsa44 } from "@noble/post-quantum/ml-dsa.js";
import { bytesToHex, hexToBytes } from "@/lib/seed";
import { tokenById, tokens, type Token } from "@/lib/tokens";
import { useWallet } from "@/lib/use-wallet";
import { hydrateSeeds, rememberAddress, type SavedWallet } from "@/lib/wallets";
import { IconShare } from "../icons";
import { TokenLogo } from "../token-modal";

async function recoverAddress(seed: string) {
  const keys = ml_dsa44.keygen(hexToBytes(seed));
  const response = await fetch("/api/account", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ publicKey: bytesToHex(keys.publicKey) }),
  });
  const text = await response.text();
  let body: { address?: string | null; error?: string } = {};
  try {
    body = text ? (JSON.parse(text) as typeof body) : {};
  } catch {
    return null;
  }
  return body.address || null;
}

function short(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-6)}`;
}

export default function Receive() {
  const { data } = useWallet();
  const [wallet, setWallet] = useState<SavedWallet | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<Token>(tokenById("ETH")!);

  const choices: Token[] = (() => {
    const list = data?.assets.map((asset) => asset.token) ?? [];
    const eth = tokenById("ETH")!;
    const merged = [eth, ...list.filter((item) => item.id !== "ETH")];
    for (const item of tokens) {
      if (!merged.some((row) => row.id === item.id)) merged.push(item);
    }
    return merged;
  })();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError("");
      const state = await hydrateSeeds();
      let active = state.wallets.find((item) => item.id === state.activeId) ?? null;
      if (active && !active.address && /^[0-9a-f]{64}$/.test(active.seed)) {
        const address = await recoverAddress(active.seed);
        if (address) {
          rememberAddress(active.id, address);
          active = { ...active, address };
        }
      }
      if (cancelled) return;
      setWallet(active);
      if (active && !active.address) setError("No address yet");
      setBusy(false);
    })().catch(() => {
      if (!cancelled) {
        setError("Could not load wallet");
        setBusy(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const address = wallet?.address ?? "";
  const qr = address
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=14&color=111111&bgcolor=ffffff&data=${encodeURIComponent(address)}`
    : "";

  async function copy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Copy blocked");
    }
  }

  async function share() {
    if (!address) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Ketra", text: address });
        return;
      }
      await copy();
    } catch {
      /* user cancelled share */
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-[1.7rem] font-medium tracking-[-0.03em]">Receive</h1>

      <div className="mt-8">
        {busy ? (
          <span className="sign-shimmer mx-auto block aspect-square max-w-[320px] rounded-[28px]" />
        ) : address ? (
          <>
            <div className="glass relative mx-auto flex aspect-square max-w-[320px] items-center justify-center rounded-[28px] p-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="" className="h-full w-full rounded-2xl bg-white object-contain p-2" />
              <span className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] ring-1 ring-black/5">
                <TokenLogo token={token} className="h-8 w-8" />
              </span>
            </div>

            <div className="relative mt-6">
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="flex w-full items-center justify-center gap-2 text-[15px] font-medium"
              >
                <TokenLogo token={token} className="h-5 w-5" />
                <span>
                  {token.name === "Ether" ? "Ethereum" : token.symbol} · {short(address)}
                </span>
                <svg viewBox="0 0 24 24" className={`h-4 w-4 text-[#8a8a8a] transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 9 L12 15 L18 9" />
                </svg>
              </button>
              {open ? (
                <div className="glass absolute inset-x-0 top-full z-10 mt-2 max-h-56 overflow-auto rounded-2xl p-2">
                  {choices.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setToken(item);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] ${item.id === token.id ? "bg-black text-white" : "hover:bg-white/50"}`}
                    >
                      <TokenLogo token={item} className="h-7 w-7" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{item.symbol}</span>
                        <span className={`block truncate text-[12px] ${item.id === token.id ? "text-white/70" : "text-[#8a8a8a]"}`}>{item.name}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-8 space-y-3">
              <button type="button" onClick={() => void copy()} className="h-12 w-full rounded-full bg-black text-[15px] font-medium text-white">
                {copied ? "Copied" : "Copy Address"}
              </button>
              <button type="button" onClick={() => void share()} className="glass-field flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-medium">
                <IconShare className="h-5 w-5" />
                Share
              </button>
            </div>
          </>
        ) : (
          <div className="glass rounded-[28px] px-6 py-12 text-center">
            <p className="text-[15px] text-[#8a8a8a]">{error || "No address yet"}</p>
            <Link href="/add" className="mt-6 inline-block h-12 rounded-full bg-black px-6 text-[15px] font-medium leading-[48px] text-white">
              Add wallet
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
