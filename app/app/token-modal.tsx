"use client";

import { useMemo, useState } from "react";
import type { Token } from "@/lib/tokens";

export function TokenPicker({
  tokens,
  selected,
  onSelect,
  onClose,
}: {
  tokens: Token[];
  selected: string;
  onSelect: (token: Token) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return tokens;
    return tokens.filter((token) => token.symbol.toLowerCase().includes(needle) || token.name.toLowerCase().includes(needle));
  }, [query, tokens]);

  return (
    <div className="glass min-h-[560px] rounded-[28px] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[1.7rem] font-medium tracking-[-0.03em]">Select a token</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="glass-field flex h-10 w-10 items-center justify-center rounded-full text-[#8a8a8a]">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 6 L18 18 M18 6 L6 18" />
          </svg>
        </button>
      </div>
      <label className="mt-5 flex items-center gap-2 glass-field rounded-2xl px-4 py-3.5">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#9a9a9a]" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="6" />
          <path d="M16 16 L20 20" />
        </svg>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or symbol"
          className="w-full bg-transparent text-[16px] outline-none placeholder:text-[#b0b0b0]"
        />
      </label>
      <div className="mt-4">
        {shown.length === 0 ? <p className="px-2 py-8 text-[15px] text-[#8a8a8a]">No token matches.</p> : null}
        {shown.map((token) => {
          const active = token.id === selected;
          return (
            <button
              key={token.id}
              type="button"
              onClick={() => onSelect(token)}
              className={`flex w-full items-center gap-4 rounded-2xl px-3 py-4 text-left ${active ? "glass-item-active" : "hover:bg-white/40"}`}
            >
              <img src={token.logo} alt="" className="h-12 w-12 rounded-full object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block text-[18px] font-medium">{token.symbol}</span>
                <span className="block text-[14px] text-[#8a8a8a]">{token.name}</span>
              </span>
              {active ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12 L10 17 L19 7" />
                </svg>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TokenPill({ token, onClick }: { token: Token; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="glass mb-1 flex shrink-0 items-center gap-2 rounded-full py-1.5 pr-2.5 pl-1.5 text-[14px] font-medium">
      <img src={token.logo} alt="" className="h-6 w-6 rounded-full object-cover" />
      {token.symbol}
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[#8a8a8a]" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 9 L12 15 L18 9" />
      </svg>
    </button>
  );
}
