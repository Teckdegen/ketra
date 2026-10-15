"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PortionButtons } from "../portion";
import { TokenPicker, TokenPill } from "../token-modal";
import { tokens, type Token } from "@/lib/tokens";

const portfolio = tokens;

export default function Send() {
  const router = useRouter();
  const [token, setToken] = useState<Token>(portfolio[0]);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [to, setTo] = useState("");

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      setTo(text.trim());
    } catch {
      setTo("");
    }
  }

  const recipient = /^0x[a-fA-F0-9]{40}$/.test(to.trim());

  function review(event: React.FormEvent) {
    event.preventDefault();
    if (!recipient) return;
    const query = new URLSearchParams({ action: "Send", asset: token.symbol, to: to.trim() });
    if (amount.trim()) query.set("amount", amount.trim());
    router.push(`/sign?${query.toString()}`);
  }

  if (open) {
    return (
      <div className="mx-auto max-w-[640px]">
        <TokenPicker
          tokens={portfolio}
          selected={token.id}
          onClose={() => setOpen(false)}
          onSelect={(next) => {
            setToken(next);
            setOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[640px]">
      <h1 className="text-[2rem] font-medium tracking-[-0.03em]">Send</h1>
      <p className="mt-2 text-[15px] text-[#8a8a8a]">Send a portfolio token to another address.</p>

      <form onSubmit={review} className="mt-6 glass rounded-[28px] p-4 sm:p-5">
        <p className="text-[16px] font-medium">Send</p>

        <div className="mt-4 glass-field rounded-2xl px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <label className="min-w-0 flex-1">
              <span className="text-[13px] text-[#8a8a8a]">To</span>
              <input
                value={to}
                onChange={(event) => setTo(event.target.value)}
                placeholder="Wallet address"
                spellCheck={false}
                className="mt-2 w-full bg-transparent text-[15px] outline-none placeholder:text-[#b0b0b0]"
              />
            </label>
            <button type="button" onClick={paste} className="flex shrink-0 items-center gap-1.5 glass-field rounded-lg px-3 py-2 text-[13px]">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="8" y="8" width="11" height="12" rx="1.5" />
                <path d="M5 15 V5.5 A1.5 1.5 0 0 1 6.5 4 H15" />
              </svg>
              Paste
            </button>
          </div>
        </div>

        <div className="mt-3 glass-field rounded-2xl px-4 py-4">
          <div className="flex items-end justify-between gap-3">
            <label className="min-w-0 flex-1">
              <span className="text-[13px] text-[#8a8a8a]">Amount</span>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                placeholder="0"
                className="mt-2 w-full bg-transparent text-[2.6rem] leading-none font-medium tracking-[-0.04em] outline-none placeholder:text-[#dedede]"
              />
            </label>
            <TokenPill token={token} onClick={() => setOpen(true)} />
          </div>
          <div className="mt-3 flex items-center justify-end gap-2 text-[13px] text-[#8a8a8a]">
            <span>Balance 0</span>
            <PortionButtons onAmount={setAmount} />
          </div>
        </div>

        <button
          type="submit"
          disabled={!recipient}
          className="mt-4 w-full glass-item rounded-xl py-3.5 text-[15px] text-[#9a9a9a] disabled:cursor-not-allowed enabled:bg-black enabled:text-white"
        >
          {recipient ? "Review" : "Enter a recipient"}
        </button>
      </form>
    </div>
  );
}
