"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addWallet, clearWallets, readWallets, setActive, type SavedWallet } from "@/lib/wallets";
import { WalletAvatar } from "../wallet-avatar";

function parseSeed(value: string) {
  const hex = value.trim().replace(/^0x/i, "").replace(/\s+/g, "");
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null;
  return hex.toLowerCase();
}

function shortAddress(value: string) {
  if (!value) return "No account yet";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
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
  const [activeId, setActiveId] = useState("");
  const [ready, setReady] = useState(false);
  const [seed, setSeed] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState<"wallets" | "export" | "privacy" | "help" | null>("wallets");
  const [revealed, setRevealed] = useState("");

  useEffect(() => {
    const state = readWallets();
    setWallets(state.wallets);
    setActiveId(state.activeId);
    setReady(true);
  }, []);

  const activeIndex = wallets.findIndex((wallet) => wallet.id === activeId);
  const active = activeIndex >= 0 ? wallets[activeIndex] : null;

  function toggle(panel: "wallets" | "export" | "privacy" | "help") {
    setError("");
    setRevealed("");
    setOpen((current) => (current === panel ? null : panel));
  }

  function switchTo(id: string) {
    const state = setActive(id);
    setWallets(state.wallets);
    setActiveId(state.activeId);
    setRevealed("");
    setError("");
  }

  function recover(event: React.FormEvent) {
    event.preventDefault();
    const next = parseSeed(seed);
    if (!next) {
      setError("Use the 32-byte ML-DSA-44 seed, as 64 hex characters.");
      return;
    }
    const wallet = addWallet(next);
    const state = readWallets();
    setWallets(state.wallets);
    setActiveId(wallet.id);
    setSeed("");
    setError("");
    setRevealed("");
    setOpen("wallets");
  }

  function reveal() {
    setRevealed(active?.seed ?? "");
  }

  async function copySeed() {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed);
    } catch {
      setError("The browser blocked the copy.");
    }
  }

  function forget() {
    clearWallets();
    setWallets([]);
    setActiveId("");
    setSeed("");
    setError("");
    setRevealed("");
    setOpen(null);
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
          <p className="mt-1 text-[1.6rem] font-medium tracking-[-0.03em]">0 ETH</p>
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
              {wallets.length > 1 ? "Switch wallet" : active ? "Owner key is on this device." : "No owner key on this device."}
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
          <span className="flex-1 text-[15px]">Export private key</span>
          <Chevron />
        </button>
        {open === "export" ? (
          <div className="border-t border-white/60 pb-4">
            {active ? (
              <div className="pt-4">
                {revealed ? (
                  <>
                    <p className="break-all glass-field rounded-xl px-3 py-3 font-mono text-[12px] leading-5">{revealed}</p>
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
                    Show seed
                  </button>
                )}
                {error ? <p className="mt-2 text-[13px] text-[#8a8a8a]">{error}</p> : null}
              </div>
            ) : (
              <form onSubmit={recover} className="pt-4">
                <p className="text-[13px] leading-5 text-[#8a8a8a]">Paste the 32-byte ML-DSA-44 seed. It stays in this browser and is not sent anywhere.</p>
                <input
                  value={seed}
                  onChange={(event) => {
                    setSeed(event.target.value);
                    setError("");
                  }}
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="64 hex characters"
                  className="mt-3 w-full glass-field rounded-xl px-3 py-3 text-[15px] outline-none"
                />
                {error ? <p className="mt-2 text-[13px] text-[#8a8a8a]">{error}</p> : null}
                <button type="submit" className="mt-3 rounded-lg bg-black px-4 py-2.5 text-[13px] font-medium text-white">
                  Recover
                </button>
              </form>
            )}
          </div>
        ) : null}
        <Link href="/add" className="flex w-full items-center gap-3 border-t border-white/60 py-4 text-left">
          <span className="flex-1 text-[15px]">Add a wallet</span>
          <Chevron />
        </Link>
      </div>

      <h2 className="mt-8 text-[1.35rem] font-medium tracking-[-0.03em]">Preferences</h2>
      <div className="mt-3 glass rounded-[28px] px-4">
        <button type="button" onClick={() => toggle("privacy")} className="flex w-full items-center gap-3 py-4 text-left">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M12 3 L20 6.5 V12c0 4.2-3 7.2-8 8.8C7 19.2 4 16.2 4 12V6.5L12 3Z" />
          </svg>
          <span className="flex-1 text-[15px]">Privacy and security</span>
          <Chevron />
        </button>
        {open === "privacy" ? (
          <p className="pb-4 text-[13px] leading-5 text-[#8a8a8a]">
            Each owner key is ML-DSA-44. Saved seeds stay in this browser. The gas payer can submit a signed batch and cannot move the assets.
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
        <button type="button" onClick={forget} className="flex w-full items-center gap-3 border-t border-white/60 py-4 text-left text-[#c4362c]">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M10 7 V5.5 A1.5 1.5 0 0 1 11.5 4 H18.5 A1.5 1.5 0 0 1 20 5.5 V18.5 A1.5 1.5 0 0 1 18.5 20 H11.5 A1.5 1.5 0 0 1 10 18.5 V17" />
            <path d="M4 12 H14 M11 9 L14 12 L11 15" />
          </svg>
          <span className="flex-1 text-[15px]">Forget this device</span>
        </button>
      </div>
    </div>
  );
}
