"use client";

import { ml_dsa44 } from "@noble/post-quantum/ml-dsa.js";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { bytesToHex, hexToBytes, newSeedPhrase, seedFromPhrase } from "@/lib/seed";
import { addWallet, hasLock, protectWallets, rememberAddress, removeWallet, unlock } from "@/lib/wallets";
import { SeedPhraseView } from "./seed-phrase";

async function addressFor(seedHex: string) {
  const keys = ml_dsa44.keygen(hexToBytes(seedHex));
  const response = await fetch("/api/account", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ publicKey: bytesToHex(keys.publicKey) }),
  });
  const body = (await response.json()) as { address?: string | null; error?: string };
  if (!body.address) throw new Error(body.error || "The account was not created.");
  return body.address;
}

export default function Welcome() {
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "create" | "import" | "password">("choose");
  const [seed, setSeed] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  function enter() {
    router.replace("/");
  }

  async function create() {
    setError("");
    setBusy("Creating the key");
    const phrase = newSeedPhrase();
    const parsed = seedFromPhrase(phrase);
    setBusy("");
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    setSeed(phrase);
    setMode("create");
  }

  async function recover(event: React.FormEvent) {
    event.preventDefault();
    const parsed = seedFromPhrase(seed);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    setSeed(parsed.phrase || parsed.seed);
    setPassword("");
    setConfirm("");
    setError("");
    setMode("password");
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    if (password.length !== 6) {
      setError("Use 6 characters.");
      return;
    }
    setError("");
    setBusy("Saving the password");
    if (hasLock()) {
      const ok = await unlock(password);
      if (!ok) {
        setBusy("");
        setError("Wrong password.");
        return;
      }
    } else if (password !== confirm) {
      setBusy("");
      setError("Those passwords do not match.");
      return;
    } else {
      const message = await protectWallets(password);
      if (message) {
        setBusy("");
        setError(message);
        return;
      }
    }
    const parsed = seedFromPhrase(seed);
    if ("error" in parsed) {
      setBusy("");
      setError(parsed.error);
      return;
    }
    const wallet = await addWallet(parsed.seed, "", parsed.phrase);
    setBusy("Creating the account");
    let address: string;
    try {
      address = await addressFor(parsed.seed);
    } catch (error) {
      removeWallet(wallet.id);
      setBusy("");
      setError(error instanceof Error ? error.message : "The account was not created, so this wallet was not saved.");
      return;
    }
    rememberAddress(wallet.id, address);
    setBusy("");
    enter();
  }

  function continueFromPhrase() {
    setPassword("");
    setConfirm("");
    setError("");
    setMode("password");
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
      <section className={`glass w-full rounded-[32px] px-7 py-10 text-center ${mode === "create" ? "max-w-[520px]" : "max-w-[420px]"}`}>
        {mode === "create" ? null : (
          <div className="flex items-center justify-center gap-3">
            <img src="/icon.png" alt="" className="h-14 w-14 rounded-[16px]" />
            <p className="text-[28px] font-bold tracking-[-0.04em] italic">KETRA</p>
          </div>
        )}

        {mode === "choose" ? (
          <>
            <p className="mx-auto mt-8 max-w-[280px] text-[15px] leading-6 text-[#6a6a6a]">
              Create a new wallet, or enter the seed phrase for one you already have.
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

        {mode === "create" && seed ? <SeedPhraseView phrase={seed} onCopy={copySeed} onNext={continueFromPhrase} /> : null}

        {mode === "import" ? (
          <form onSubmit={recover}>
            <p className="mx-auto mt-8 max-w-[300px] text-[15px] leading-6 text-[#6a6a6a]">
              Enter the seed phrase. It stays in this browser and is not sent.
            </p>
            <label className="mt-6 block text-left text-[13px] text-[#8a8a8a]" htmlFor="quantum-key">
              Seed phrase
            </label>
            <textarea
              id="quantum-key"
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              rows={4}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className="glass-field mt-2 w-full resize-none rounded-2xl px-4 py-3 text-left text-[15px] leading-6 outline-none"
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

        {mode === "password" ? (
          <form onSubmit={savePassword}>
            <p className="mx-auto mt-8 max-w-[300px] text-[15px] leading-6 text-[#6a6a6a]">
              {hasLock() ? "Enter the 6-character password to save this wallet." : "Set a 6-character password. The wallet is saved after this."}
            </p>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              maxLength={6}
              autoComplete="off"
              spellCheck={false}
              placeholder="6 characters"
              className="glass-field mt-6 h-12 w-full rounded-2xl px-4 text-center text-[18px] tracking-[0.3em] outline-none"
            />
            {hasLock() ? null : (
              <input
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                type="password"
                maxLength={6}
                autoComplete="off"
                spellCheck={false}
                placeholder="Repeat it"
                className="glass-field mt-3 h-12 w-full rounded-2xl px-4 text-center text-[18px] tracking-[0.3em] outline-none"
              />
            )}
            <button type="submit" disabled={Boolean(busy)} className="mt-4 h-12 w-full rounded-full bg-black text-[15px] font-medium text-white disabled:opacity-50">
              {busy || "Continue"}
            </button>
          </form>
        ) : null}

        {error ? <p className="mt-4 text-[13px] leading-5 text-[#8a8a8a]">{error}</p> : null}
      </section>
    </main>
  );
}
