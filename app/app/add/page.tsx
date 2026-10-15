"use client";

import { ml_dsa44 } from "@noble/post-quantum/ml-dsa.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addWallet, rememberAddress } from "@/lib/wallets";

function hex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesFromHex(value: string) {
  const out = new Uint8Array(value.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function parseSeed(value: string) {
  const next = value.trim().replace(/^0x/i, "").replace(/\s+/g, "");
  if (!/^[0-9a-fA-F]{64}$/.test(next)) return null;
  return next.toLowerCase();
}

async function addressFor(seedHex: string) {
  const keys = ml_dsa44.keygen(bytesFromHex(seedHex));
  const response = await fetch("/api/account", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ publicKey: hex(keys.publicKey) }),
  });
  const body = (await response.json()) as { address?: string | null };
  return body.address ?? null;
}

export default function AddWallet() {
  const router = useRouter();
  const [seed, setSeed] = useState("");
  const [fresh, setFresh] = useState("");
  const [shown, setShown] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function create() {
    setError("");
    setBusy("Creating the key");
    const next = new Uint8Array(ml_dsa44.lengths.seed);
    crypto.getRandomValues(next);
    const seedHex = hex(next);
    const wallet = addWallet(seedHex);
    setFresh(seedHex);
    setBusy("");
    try {
      const address = await addressFor(seedHex);
      if (address) rememberAddress(wallet.id, address);
    } catch {
      setError("The key is on this device. The factory did not return an address.");
    }
  }

  async function recover(event: React.FormEvent) {
    event.preventDefault();
    const next = parseSeed(seed);
    if (!next) {
      setError("Use the quantum private key or seed phrase as 64 hex characters.");
      return;
    }
    setError("");
    setBusy("Reading the key");
    const wallet = addWallet(next);
    try {
      const address = await addressFor(next);
      if (address) rememberAddress(wallet.id, address);
      router.replace("/");
    } catch {
      setError("The key is on this device. The factory did not return an address.");
      router.replace("/");
    } finally {
      setBusy("");
    }
  }

  async function copySeed() {
    try {
      await navigator.clipboard.writeText(fresh);
    } catch {
      setError("The browser blocked the copy.");
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-[1.7rem] font-medium tracking-[-0.03em]">Add a wallet</h1>
      <p className="mt-2 text-[14px] leading-6 text-[#8a8a8a]">
        Create another wallet, or enter the quantum private key or seed phrase for one you already have.
      </p>

      {fresh ? (
        <div className="mt-6 glass rounded-[28px] p-5">
          <p className="text-[13px] leading-5 text-[#8a8a8a]">This is the quantum private key or seed phrase. Copy it before you leave.</p>
          <p className="mt-3 break-all font-mono text-[12px] leading-5">{shown ? fresh : "••••"}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setShown((value) => !value)} className="glass-field rounded-lg px-4 py-2.5 text-[13px]">
              {shown ? "Hide" : "Show"}
            </button>
            <button type="button" onClick={copySeed} className="rounded-lg bg-black px-4 py-2.5 text-[13px] font-medium text-white">
              Copy
            </button>
            <button type="button" onClick={() => router.replace("/")} className="rounded-lg bg-black px-4 py-2.5 text-[13px] font-medium text-white">
              Done
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={create}
            disabled={Boolean(busy)}
            className="mt-6 h-12 w-full rounded-full bg-black text-[15px] font-medium text-white disabled:opacity-50"
          >
            {busy || "Create a new wallet"}
          </button>
          <form onSubmit={recover} className="mt-6 glass rounded-[28px] p-5">
            <label className="block text-[13px] text-[#8a8a8a]" htmlFor="add-key">
              Quantum private key or seed phrase
            </label>
            <textarea
              id="add-key"
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              rows={4}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className="glass-field mt-2 w-full resize-none rounded-2xl px-4 py-3 font-mono text-[13px] leading-5 outline-none"
            />
            <button
              type="submit"
              disabled={Boolean(busy)}
              className="mt-3 h-11 w-full rounded-full bg-black text-[14px] font-medium text-white disabled:opacity-50"
            >
              Add this wallet
            </button>
          </form>
        </>
      )}

      {error ? <p className="mt-3 text-[13px] text-[#8a8a8a]">{error}</p> : null}
      <Link href="/settings" className="mt-6 inline-block text-[13px] text-[#8a8a8a]">
        Back to settings
      </Link>
    </div>
  );
}
