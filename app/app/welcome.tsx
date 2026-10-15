"use client";

import { ml_dsa44 } from "@noble/post-quantum/ml-dsa.js";
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

export default function Welcome() {
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "create" | "import">("choose");
  const [seed, setSeed] = useState("");
  const [shown, setShown] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  function enter() {
    router.replace("/");
  }

  async function create() {
    setError("");
    setBusy("Creating the key");
    const next = new Uint8Array(ml_dsa44.lengths.seed);
    crypto.getRandomValues(next);
    const seedHex = hex(next);
    const wallet = addWallet(seedHex);
    setSeed(seedHex);
    setShown(true);
    setMode("create");
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
    } catch {
      setError("The key is on this device. The factory did not return an address.");
    } finally {
      setBusy("");
    }
    enter();
  }

  async function copySeed() {
    try {
      await navigator.clipboard.writeText(seed);
    } catch {
      setError("The browser blocked the copy.");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <section className="glass w-full max-w-[420px] rounded-[32px] px-7 py-10 text-center">
        <div className="flex items-center justify-center gap-3">
          <img src="/icon.png" alt="" className="h-14 w-14 rounded-[16px]" />
          <p className="text-[28px] font-bold tracking-[-0.04em] italic">KETRA</p>
        </div>

        {mode === "choose" ? (
          <>
            <p className="mx-auto mt-8 max-w-[280px] text-[15px] leading-6 text-[#6a6a6a]">
              Create a new wallet, or enter the quantum private key or seed phrase for one you already have.
            </p>
            <button
              type="button"
              onClick={create}
              disabled={Boolean(busy)}
              className="mt-10 h-12 w-full rounded-full bg-black text-[15px] font-medium text-white disabled:opacity-50"
            >
              {busy || "Create a new wallet"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSeed("");
                setError("");
                setMode("import");
              }}
              className="glass-field mt-3 h-12 w-full rounded-full text-[15px] font-medium"
            >
              I already have a wallet
            </button>
          </>
        ) : null}

        {mode === "create" && seed ? (
          <>
            <p className="mx-auto mt-8 max-w-[300px] text-[15px] leading-6 text-[#6a6a6a]">
              This is the quantum private key or seed phrase. It stays on this device. Copy it before you continue.
            </p>
            <p className="mt-5 break-all rounded-2xl bg-white/70 px-4 py-4 text-left font-mono text-[12px] leading-5">
              {shown ? seed : "••••"}
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setShown((value) => !value)} className="glass-field h-11 flex-1 rounded-full text-[14px]">
                {shown ? "Hide" : "Show"}
              </button>
              <button type="button" onClick={copySeed} className="h-11 flex-1 rounded-full bg-black text-[14px] font-medium text-white">
                Copy
              </button>
            </div>
            <button type="button" onClick={enter} className="mt-3 h-12 w-full rounded-full bg-black text-[15px] font-medium text-white">
              Continue
            </button>
          </>
        ) : null}

        {mode === "import" ? (
          <form onSubmit={recover}>
            <p className="mx-auto mt-8 max-w-[300px] text-[15px] leading-6 text-[#6a6a6a]">
              Enter the quantum private key or seed phrase. It stays in this browser and is not sent.
            </p>
            <label className="mt-6 block text-left text-[13px] text-[#8a8a8a]" htmlFor="quantum-key">
              Quantum private key or seed phrase
            </label>
            <textarea
              id="quantum-key"
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              rows={4}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className="glass-field mt-2 w-full resize-none rounded-2xl px-4 py-3 text-left font-mono text-[13px] leading-5 outline-none"
            />
            <button
              type="submit"
              disabled={Boolean(busy)}
              className="mt-4 h-12 w-full rounded-full bg-black text-[15px] font-medium text-white disabled:opacity-50"
            >
              {busy || "Continue"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("choose");
                setSeed("");
                setError("");
              }}
              className="glass-field mt-3 h-12 w-full rounded-full text-[15px] font-medium"
            >
              Back
            </button>
          </form>
        ) : null}

        {error ? <p className="mt-4 text-[13px] leading-5 text-[#8a8a8a]">{error}</p> : null}
      </section>
    </main>
  );
}
