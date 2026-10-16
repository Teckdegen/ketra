"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ml_dsa44 } from "@noble/post-quantum/ml-dsa.js";
import { bytesToHex, hexToBytes, phraseFromSeed, seedFromPhrase } from "@/lib/seed";
import { addWallet, changePassword, clearWallets, hasLock, lockApp, protectWallets, readWallets, rememberAddress, removeWallet, setActive, unlock, type SavedWallet } from "@/lib/wallets";
import { WalletAvatar } from "../wallet-avatar";
import { formatValue, setBalanceUnit, useBalanceUnit, type BalanceUnit } from "@/lib/display";
import { useWallet } from "@/lib/use-wallet";

function SecurityPanel() {
  const [locked, setLocked] = useState(false);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after hydration
    setLocked(hasLock());
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaved("");
    if (password.length !== 6 || confirm.length !== 6 || (locked && current.length !== 6)) {
      setMessage("Use 6 characters.");
      return;
    }
    if (password !== confirm) {
      setMessage("Those passwords do not match.");
      return;
    }
    const result = locked ? await changePassword(current, password) : await protectWallets(password);
    if (result) {
      setMessage(result);
      return;
    }
    setLocked(true);
    setCurrent("");
    setPassword("");
    setConfirm("");
    setMessage("");
    setSaved(locked ? "Password changed." : "Password saved. It locks this device.");
  }

  return (
    <form onSubmit={save} className="mt-3 glass rounded-[28px] px-4 py-4">
      <p className="text-[15px] font-medium">{locked ? "Password is on" : "Password is off"}</p>
      <p className="mt-1 text-[13px] leading-5 text-[#8a8a8a]">
        A 6-character password locks this device. The seed phrase stays in this browser, and the password does not leave it.
      </p>
      {locked ? (
        <input
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          type="password"
          maxLength={6}
          autoComplete="off"
          spellCheck={false}
          placeholder="Current password"
          className="mt-4 w-full glass-field rounded-xl px-3 py-3 text-[15px] outline-none"
        />
      ) : null}
      <input
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        type="password"
        maxLength={6}
        autoComplete="off"
        spellCheck={false}
        placeholder={locked ? "New password" : "6 characters"}
        className="mt-3 w-full glass-field rounded-xl px-3 py-3 text-[15px] outline-none"
      />
      <input
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        type="password"
        maxLength={6}
        autoComplete="off"
        spellCheck={false}
        placeholder="Repeat it"
        className="mt-3 w-full glass-field rounded-xl px-3 py-3 text-[15px] outline-none"
      />
      {message ? <p className="mt-2 text-[13px] text-[#8a8a8a]">{message}</p> : null}
      {saved ? <p className="mt-2 text-[13px] text-[#8a8a8a]">{saved}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="submit" className="rounded-lg bg-black px-4 py-2.5 text-[13px] font-medium text-white">
          {locked ? "Change password" : "Set password"}
        </button>
        {locked ? (
          <button
            type="button"
            onClick={() => lockApp()}
            className="glass-field rounded-lg px-4 py-2.5 text-[13px]"
          >
            Lock now
          </button>
        ) : null}
      </div>
    </form>
  );
}

function shortAddress(value: string) {
  if (!value) return "No account yet";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

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

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#b0b0b0]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M9 6 L15 12 L9 18" />
    </svg>
  );
}

export default function Settings() {
  const [wallets, setWallets] = useState<SavedWallet[]>([]);
  const { data: overview } = useWallet();
  const unit = useBalanceUnit();
  const [activeId, setActiveId] = useState("");
  const [ready, setReady] = useState(false);
  const [seed, setSeed] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState<"wallets" | "export" | "privacy" | "help" | "display" | null>("wallets");
  const [revealed, setRevealed] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmForget, setConfirmForget] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [recoverPassword, setRecoverPassword] = useState("");
  const [recoverConfirm, setRecoverConfirm] = useState("");

  useEffect(() => {
    const state = readWallets();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after hydration
    setWallets(state.wallets);
    setActiveId(state.activeId);
    setReady(true);
  }, []);

  const activeIndex = wallets.findIndex((wallet) => wallet.id === activeId);
  const active = activeIndex >= 0 ? wallets[activeIndex] : null;

  function toggle(panel: "wallets" | "export" | "privacy" | "help" | "display") {
    setError("");
    setRevealed("");
    setOpen((current) => (current === panel ? null : panel));
  }

  function chooseUnit(next: BalanceUnit) {
    setBalanceUnit(next);
  }

  function switchTo(id: string) {
    const wallet = wallets.find((item) => item.id === id);
    if (!wallet?.address) {
      window.location.assign("/create");
      return;
    }
    const state = setActive(id);
    setWallets(state.wallets);
    setActiveId(state.activeId);
    setRevealed("");
    setError("");
    setConfirmDelete(false);
  }

  async function recover(event: React.FormEvent) {
    event.preventDefault();
    const parsed = seedFromPhrase(seed);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    if (recoverPassword.length !== 6) {
      setError("Use 6 characters.");
      return;
    }
    if (hasLock()) {
      const ok = await unlock(recoverPassword);
      if (!ok) {
        setError("Wrong password.");
        return;
      }
    } else if (recoverPassword !== recoverConfirm) {
      setError("Those passwords do not match.");
      return;
    } else {
      const message = await protectWallets(recoverPassword);
      if (message) {
        setError(message);
        return;
      }
    }
    const wallet = await addWallet(parsed.seed, "", parsed.phrase);
    setError("Creating the account");
    let address: string;
    try {
      address = await addressFor(parsed.seed);
    } catch (error) {
      removeWallet(wallet.id);
      setError(error instanceof Error ? error.message : "The account was not created, so this wallet was not saved.");
      return;
    }
    rememberAddress(wallet.id, address);
    const state = readWallets();
    setWallets(state.wallets);
    setActiveId(wallet.id);
    setSeed("");
    setError("");
    setRevealed("");
    setOpen("wallets");
  }

  function reveal() {
    if (!active?.seed && !active?.phrase) return;
    if (active.phrase) {
      setRevealed(active.phrase);
      return;
    }
    setRevealed(phraseFromSeed(active.seed));
  }

  async function copySeed() {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed);
    } catch {
      setError("The browser blocked the copy.");
    }
  }

  async function dropActive(event: React.FormEvent) {
    event.preventDefault();
    if (!active) return;
    if (!hasLock()) {
      setError("Set a password in Security first.");
      return;
    }
    if (deletePassword.length !== 6) {
      setError("Use 6 characters.");
      return;
    }
    const ok = await unlock(deletePassword);
    if (!ok) {
      setError("Wrong password.");
      return;
    }
    const state = removeWallet(active.id);
    setWallets(state.wallets);
    setActiveId(state.activeId);
    setSeed("");
    setError("");
    setRevealed("");
    setConfirmDelete(false);
    setDeletePassword("");
    if (state.wallets.length === 0) window.location.assign("/create");
  }

  function forget() {
    clearWallets();
    window.location.replace("/create");
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-[2rem] font-medium tracking-[-0.04em]">Settings</h1>

      <div className="mt-6 glass flex items-center gap-3 rounded-[28px] px-4 py-4">
        <WalletAvatar seed={active?.avatar} />
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-medium">{active ? `Wallet ${activeIndex + 1}` : "No account yet"}</span>
          <span className="block text-[13px] text-[#8a8a8a]">{active?.address ? shortAddress(active.address) : "Robinhood ETH"}</span>
        </span>
        <Link href="/add" aria-label="Add a wallet" className="glass-field flex h-10 w-10 items-center justify-center rounded-full">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 5 V19 M5 12 H19" />
          </svg>
        </Link>
      </div>

      <div className="mt-3 glass grid grid-cols-2 rounded-[28px] px-2 py-4">
        <div className="px-4">
          <p className="text-[13px] text-[#8a8a8a]">Balance</p>
          <p className="mt-1 truncate text-[1.6rem] font-medium tracking-[-0.03em]">
            {overview ? formatValue(overview.totalUsd, overview.totalEth, unit) : "…"}
          </p>
        </div>
        <div className="border-l border-white/70 px-4">
          <p className="text-[13px] text-[#8a8a8a]">On this device</p>
          <p className="mt-1 text-[1.6rem] font-medium tracking-[-0.03em]">{ready && wallets.length > 0 ? wallets.length : "None"}</p>
        </div>
      </div>

      <h2 className="mt-8 text-[1.35rem] font-medium tracking-[-0.03em]">Wallet</h2>
      <div className="mt-3 glass rounded-[28px] px-4">
        <button type="button" onClick={() => toggle("wallets")} className="flex w-full items-center gap-3 py-4 text-left">
          <WalletAvatar seed={active?.avatar} className="h-10 w-10" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">{active ? `Wallet ${activeIndex + 1}` : "Ketra account"}</span>
            <span className="block text-[13px] text-[#8a8a8a]">
              {wallets.length > 1 ? "Switch wallet" : active ? "Seed phrase is on this device." : "No seed phrase on this device."}
            </span>
          </span>
          <Chevron />
        </button>
        {open === "wallets" && wallets.length > 0 ? (
          <div className="border-t border-white/60">
            {wallets.map((wallet, index) => {
              const selected = wallet.id === activeId;
              return (
                <button key={wallet.id} type="button" onClick={() => switchTo(wallet.id)} className="flex w-full items-center gap-3 border-t border-white/40 py-3 text-left first:border-t-0">
                  <WalletAvatar seed={wallet.avatar} className="h-10 w-10" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium">Wallet {index + 1}</span>
                    <span className="block text-[13px] text-[#8a8a8a]">{shortAddress(wallet.address)}</span>
                  </span>
                  {selected ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12 L10 17 L19 7" />
                    </svg>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
        <button type="button" onClick={() => toggle("export")} className="flex w-full items-center gap-3 border-t border-white/60 py-4 text-left">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#3a3a3a]" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="8" cy="14" r="3" />
            <path d="M10.2 12.2 L20 4 M16 4 H20 V8" />
          </svg>
          <span className="flex-1 text-[15px]">Seed phrase</span>
          <Chevron />
        </button>
        {open === "export" ? (
          <div className="border-t border-white/60 pb-4">
            {active ? (
              <div className="pt-4">
                {revealed ? (
                  <>
                    <ol className="grid max-h-[280px] grid-cols-2 gap-2 overflow-y-auto">
                      {revealed.split(/\s+/).filter(Boolean).map((word, index) => (
                        <li key={index} className="glass-field flex items-center gap-2 rounded-xl px-3 py-2.5">
                          <span className="w-5 shrink-0 text-[12px] text-[#8a8a8a]">{index + 1}</span>
                          <span className="text-[14px] font-medium">{word}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={copySeed} className="rounded-lg bg-black px-4 py-2.5 text-[13px] font-medium text-white">
                        Copy
                      </button>
                      <button type="button" onClick={() => setRevealed("")} className="glass-field rounded-lg px-4 py-2.5 text-[13px]">
                        Hide
                      </button>
                    </div>
                  </>
                ) : (
                  <button type="button" onClick={reveal} className="rounded-lg bg-black px-4 py-2.5 text-[13px] font-medium text-white">
                    Show seed phrase
                  </button>
                )}
                {error ? <p className="mt-2 text-[13px] text-[#8a8a8a]">{error}</p> : null}
              </div>
            ) : (
              <form onSubmit={recover} className="pt-4">
                <p className="text-[13px] leading-5 text-[#8a8a8a]">Paste the seed phrase. It stays in this browser and is not sent anywhere.</p>
                <textarea
                  value={seed}
                  onChange={(event) => {
                    setSeed(event.target.value);
                    setError("");
                  }}
                  rows={4}
                  autoComplete="off"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  placeholder="12 words"
                  className="mt-3 w-full resize-none glass-field rounded-xl px-3 py-3 text-[15px] leading-6 outline-none"
                />
                <input
                  value={recoverPassword}
                  onChange={(event) => setRecoverPassword(event.target.value)}
                  type="password"
                  maxLength={6}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={hasLock() ? "Password" : "6 characters"}
                  className="mt-3 w-full glass-field rounded-xl px-3 py-3 text-[15px] outline-none"
                />
                {hasLock() ? null : (
                  <input
                    value={recoverConfirm}
                    onChange={(event) => setRecoverConfirm(event.target.value)}
                    type="password"
                    maxLength={6}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Repeat it"
                    className="mt-3 w-full glass-field rounded-xl px-3 py-3 text-[15px] outline-none"
                  />
                )}
                {error ? <p className="mt-2 text-[13px] text-[#8a8a8a]">{error}</p> : null}
                <button
                  type="submit"
                  disabled={error === "Creating the account"}
                  className="mt-3 rounded-lg bg-black px-4 py-2.5 text-[13px] font-medium text-white disabled:opacity-50"
                >
                  {error === "Creating the account" ? "Creating the account" : "Recover"}
                </button>
              </form>
            )}
          </div>
        ) : null}
        <Link href="/add" className="flex w-full items-center gap-3 border-t border-white/60 py-4 text-left">
          <span className="flex-1 text-[15px]">Add a wallet</span>
          <Chevron />
        </Link>
        {active ? (
          <div className="border-t border-white/60 py-4">
            {confirmDelete ? (
              <form onSubmit={dropActive}>
                <p className="text-[13px] leading-5 text-[#8a8a8a]">
                  This removes Wallet {activeIndex + 1} from this device. Enter the 6-character password. The seed phrase is the only way back.
                </p>
                <input
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  type="password"
                  maxLength={6}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Password"
                  className="mt-3 w-full glass-field rounded-xl px-3 py-3 text-[15px] outline-none"
                />
                {error ? <p className="mt-2 text-[13px] text-[#8a8a8a]">{error}</p> : null}
                <div className="mt-3 flex gap-2">
                  <button type="submit" className="rounded-lg bg-[#c4362c] px-4 py-2.5 text-[13px] font-medium text-white">
                    Delete this wallet
                  </button>
                  <button type="button" onClick={() => { setConfirmDelete(false); setDeletePassword(""); setError(""); }} className="glass-field rounded-lg px-4 py-2.5 text-[13px]">
                    Keep it
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="text-left text-[15px] text-[#c4362c]">
                Delete this wallet
              </button>
            )}
          </div>
        ) : null}
      </div>

      <h2 className="mt-8 text-[1.35rem] font-medium tracking-[-0.03em]">Security</h2>
      <SecurityPanel />

      <h2 className="mt-8 text-[1.35rem] font-medium tracking-[-0.03em]">Preferences</h2>
      <div className="mt-3 glass rounded-[28px] px-4">
        <button type="button" onClick={() => toggle("display")} className="flex w-full items-center gap-3 py-4 text-left">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 8 V12 L15 14" />
          </svg>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px]">Balance display</span>
            <span className="block text-[13px] text-[#8a8a8a]">{unit === "eth" ? "Shown in ETH" : "Shown in USD"}</span>
          </span>
          <Chevron />
        </button>
        {open === "display" ? (
          <div className="border-t border-white/60 pb-4">
            <p className="pt-3 text-[13px] leading-5 text-[#8a8a8a]">
              Tokens are quoted to ETH onchain, then ETH is priced in USD through GeckoTerminal. Pick which one the portfolio shows first.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(
                [
                  { id: "usd", label: "USD", hint: "Dollar value" },
                  { id: "eth", label: "ETH", hint: "Ether value" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => chooseUnit(option.id)}
                  className={`rounded-2xl px-4 py-3 text-left ${unit === option.id ? "bg-black text-white" : "glass-field"}`}
                >
                  <span className="block text-[15px] font-medium">{option.label}</span>
                  <span className={`block text-[12px] ${unit === option.id ? "text-white/70" : "text-[#8a8a8a]"}`}>{option.hint}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <button type="button" onClick={() => toggle("privacy")} className="flex w-full items-center gap-3 border-t border-white/60 py-4 text-left">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M12 3 L20 6.5 V12c0 4.2-3 7.2-8 8.8C7 19.2 4 16.2 4 12V6.5L12 3Z" />
          </svg>
          <span className="flex-1 text-[15px]">Privacy and security</span>
          <Chevron />
        </button>
        {open === "privacy" ? (
          <p className="pb-4 text-[13px] leading-5 text-[#8a8a8a]">
            The seed phrase stays in this browser. The gas payer can submit a signed batch and cannot move the assets.
          </p>
        ) : null}
        <button type="button" onClick={() => toggle("help")} className="flex w-full items-center gap-3 border-t border-white/60 py-4 text-left">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="12" cy="12" r="8" />
            <path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.7.3-1.2.8-1.2 1.6" />
            <path d="M12 17h.01" />
          </svg>
          <span className="flex-1 text-[15px]">Help and support</span>
          <Chevron />
        </button>
        {open === "help" ? (
          <p className="pb-4 text-[13px] leading-5 text-[#8a8a8a]">
            Robinhood does not have this account yet. Create it before a spend can be signed.{" "}
            <Link href="/add" className="text-[#111] underline decoration-[#ddd] underline-offset-2">
              Add a wallet
            </Link>
          </p>
        ) : null}
        {confirmForget ? (
          <div className="border-t border-white/60 py-4">
            <p className="text-[13px] leading-5 text-[#8a8a8a]">This removes every wallet on this device. A seed phrase is the only way back.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={forget} className="rounded-lg bg-[#c4362c] px-4 py-2.5 text-[13px] font-medium text-white">
                Forget this device
              </button>
              <button type="button" onClick={() => setConfirmForget(false)} className="glass-field rounded-lg px-4 py-2.5 text-[13px]">
                Keep them
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmForget(true)} className="flex w-full items-center gap-3 border-t border-white/60 py-4 text-left text-[#c4362c]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M10 7 V5.5 A1.5 1.5 0 0 1 11.5 4 H18.5 A1.5 1.5 0 0 1 20 5.5 V18.5 A1.5 1.5 0 0 1 18.5 20 H11.5 A1.5 1.5 0 0 1 10 18.5 V17" />
              <path d="M4 12 H14 M11 9 L14 12 L11 15" />
            </svg>
            <span className="flex-1 text-[15px]">Forget this device</span>
          </button>
        )}
      </div>
    </div>
  );
}
