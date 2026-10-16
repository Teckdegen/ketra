"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ml_dsa44 } from "@noble/post-quantum/ml-dsa.js";
import { bytesToHex, hexToBytes } from "@/lib/seed";
import { hydrateSeeds, readWallets, rememberAddress, type SavedWallet } from "@/lib/wallets";

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

export default function Receive() {
  const [wallet, setWallet] = useState<SavedWallet | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

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
      if (active && !active.address) setError("This wallet has no on-chain account yet.");
      setBusy(false);
    })().catch(() => {
      if (!cancelled) {
        setError("The wallet could not be read.");
        setBusy(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function copy() {
    if (!wallet?.address) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("The browser blocked the copy.");
    }
  }

  const address = wallet?.address ?? "";
  const qr = address
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(address)}`
    : "";

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-[1.7rem] font-medium tracking-[-0.03em]">Receive</h1>
      <p className="mt-2 text-[14px] leading-6 text-[#8a8a8a]">
        Send ETH or tokens on Robinhood Chain to this account. They show up in the portfolio once confirmed.
      </p>

      <div className="mt-6 glass rounded-[28px] px-6 py-8 text-center">
        {busy ? (
          <span className="sign-shimmer mx-auto block h-40 w-40 rounded-[24px]" />
        ) : address ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Receive QR code" className="mx-auto h-44 w-44 rounded-[24px] bg-white p-3" />
            <p className="mt-5 break-all font-mono text-[13px] leading-6 text-[#111]">{address}</p>
            <button type="button" onClick={() => void copy()} className="mt-5 rounded-full bg-black px-5 py-2.5 text-[13px] font-medium text-white">
              {copied ? "Copied" : "Copy address"}
            </button>
          </>
        ) : (
          <>
            <p className="text-[15px] text-[#8a8a8a]">{error || "No address yet"}</p>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-5 text-[#8a8a8a]">
              Create or recover a wallet first. If you already did, open Settings and check the active wallet.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Link href="/add" className="rounded-lg bg-black px-4 py-2.5 text-[13px] font-medium text-white">
                Add wallet
              </Link>
              <Link href="/settings" className="glass-field rounded-lg px-4 py-2.5 text-[13px]">
                Settings
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
