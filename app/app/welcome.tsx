"use client";

import { ml_dsa44 } from "@noble/post-quantum/ml-dsa.js";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { bytesToHex, hexToBytes, newSeedPhrase, seedFromPhrase } from "@/lib/seed";
import {
  addWallet,
  clearOrphanLock,
  hasLock,
  protectWallets,
  rememberAddress,
  resetDevice,
  unlock,
} from "@/lib/wallets";
import { SeedPhraseEntry, SeedPhraseView } from "./seed-phrase";

async function addressFor(seedHex: string) {
  const keys = ml_dsa44.keygen(hexToBytes(seedHex));
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
    throw new Error("The account server returned an unreadable answer. Try again after redeploy.");
  }
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
  const [forgetConfirm, setForgetConfirm] = useState(false);

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
    clearOrphanLock();
    setSeed(parsed.phrase || parsed.seed);
    setPassword("");
    setConfirm("");
    setError("");
    setForgetConfirm(false);
    setMode("password");
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    if (password.length !== 6) {
      setError("Use 6 characters.");
      return;
    }
    setError("");
    clearOrphanLock();
    const existing = hasLock();

    if (existing) {
      setBusy("Checking the password");
      const ok = await unlock(password);
      if (!ok) {
        setBusy("");
        setError("Wrong password.");
        return;
      }
    } else if (password !== confirm) {
      setError("Those passwords do not match.");
      return;
    }

    const parsed = seedFromPhrase(seed);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    setBusy("Creating the account");
    let address: string;
    try {
      address = await addressFor(parsed.seed);
    } catch (error) {
      setBusy("");
      setError(error instanceof Error ? error.message : "The account was not created, so this wallet was not saved.");
      return;
    }
    const wallet = await addWallet(parsed.seed, address, parsed.phrase);
    rememberAddress(wallet.id, address);
    if (!existing) {
      const message = await protectWallets(password);
      if (message) {
        setBusy("");
        setError(message);
        return;
      }
    }
    setBusy("");
    enter();
  }

  function continueFromPhrase() {
    clearOrphanLock();
    setPassword("");
    setConfirm("");
    setError("");
    setForgetConfirm(false);
    setMode("password");
  }

  async function copySeed() {
    await navigator.clipboard.writeText(seed);
  }

  function forgetDevice() {
    resetDevice("/create");
  }

  const tall = mode === "create" || mode === "import";

  return (
    <main className="fixed inset-0 grid place-items-center overflow-hidden overscroll-none px-5">
      <section
        className={`glass w-full max-h-[min(100dvh-1.5rem,100%)] rounded-[32px] px-7 py-8 text-center sm:py-10 ${
          tall ? "max-w-[520px] overflow-y-auto" : "max-w-[420px] overflow-hidden"
        }`}
      >
        {mode === "create" || mode === "import" ? null : (
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
          <form onSubmit={recover} className="text-left">
            <h2 className="text-center text-[13px] font-medium tracking-[0.16em]">ENTER SEED PHRASE</h2>
            <p className="mx-auto mt-4 max-w-[340px] text-center text-[14px] leading-6 text-[#6a6a6a]">
              Type each word in order, or paste the whole phrase.
              <br />
              It stays in this browser and is not sent.
            </p>
            <SeedPhraseEntry
              value={seed}
              onChange={(phrase) => {
                setSeed(phrase);
                setError("");
              }}
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
              {hasLock()
                ? "Enter the 6-character password to save this wallet."
                : "Set a 6-character password. It is saved only after the account is created."}
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
            {hasLock() ? (
              forgetConfirm ? (
                <div className="mt-4 text-left">
                  <p className="text-[13px] leading-5 text-[#8a8a8a]">
                    This wipes every wallet and the device password. You start fresh. A seed phrase is the only way back into an old wallet.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={forgetDevice} className="rounded-full bg-[#c4362c] px-4 py-2.5 text-[13px] font-medium text-white">
                      Wipe and start over
                    </button>
                    <button type="button" onClick={() => setForgetConfirm(false)} className="glass-field rounded-full px-4 py-2.5 text-[13px]">
                      Keep them
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setForgetConfirm(true)} className="mt-4 text-[13px] text-[#8a8a8a] underline decoration-[#ddd] underline-offset-2">
                  Forgot password?
                </button>
              )
            ) : null}
          </form>
        ) : null}

        {error ? <p className="mt-4 text-[13px] leading-5 text-[#8a8a8a]">{error}</p> : null}
      </section>
    </main>
  );
}
