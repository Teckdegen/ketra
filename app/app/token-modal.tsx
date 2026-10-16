"use client";

import { useEffect, useMemo, useState } from "react";
import { displayAmount } from "@/lib/amount";
import { money } from "@/lib/format";
import { isAddress, type Token } from "@/lib/tokens";
import { rememberToken, useWallet } from "@/lib/use-wallet";

export function TokenLogo({ token, className = "h-6 w-6" }: { token: Pick<Token, "logo" | "symbol">; className?: string }) {
  const [broken, setBroken] = useState("");
  if (!token.logo || broken === token.logo) {
    return (
      <span className={`${className} flex shrink-0 items-center justify-center rounded-full bg-black text-[40%] font-medium text-white`}>
        {token.symbol.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <img src={token.logo} alt="" onError={() => setBroken(token.logo)} className={`${className} shrink-0 rounded-full bg-white object-cover`} />;
}

export function TokenPicker({
  tokens,
  selected,
  onSelect,
  onClose,
  searchable = true,
}: {
  tokens: Token[];
  selected: string;
  onSelect: (token: Token) => void;
  onClose: () => void;
  searchable?: boolean;
}) {
  const { data } = useWallet();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ query: string; tokens: Token[] } | null>(null);
  const needle = query.trim();
  const remote = searchable && (isAddress(needle) || needle.length >= 2);
  const searching = remote && found?.query !== needle;

  useEffect(() => {
    if (!remote) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/tokens?q=${encodeURIComponent(needle)}`, { signal: controller.signal })
        .then((response) => response.json() as Promise<{ tokens?: Token[] }>)
        .then((body) => setFound({ query: needle, tokens: body.tokens ?? [] }))
        .catch(() => {
          if (!controller.signal.aborted) setFound({ query: needle, tokens: [] });
        });
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [remote, needle]);

  const held = useMemo(() => {
    const map = new Map<string, { balance: string; usd: number | null }>();
    data?.assets.forEach((asset) => map.set(asset.token.id, { balance: asset.balance, usd: asset.usd }));
    return map;
  }, [data]);

  const shown = useMemo(() => {
    const lower = needle.toLowerCase();
    const base = [...tokens];
    data?.assets.forEach((asset) => {
      if (!base.some((token) => token.id === asset.token.id)) base.push(asset.token);
    });
    const local = lower
      ? base.filter((token) => token.symbol.toLowerCase().includes(lower) || token.name.toLowerCase().includes(lower) || token.address?.toLowerCase() === lower)
      : base;
    const extra = remote && found?.query === needle ? found.tokens.filter((token) => !local.some((item) => item.id === token.id)) : [];
    return [...local, ...extra];
  }, [tokens, data, needle, remote, found]);

  function pick(token: Token) {
    if (token.address && !tokens.some((item) => item.id === token.id)) rememberToken(token);
    onSelect(token);
  }

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
          placeholder={searchable ? "Search name, symbol, or paste a contract" : "Search name or symbol"}
          spellCheck={false}
          className="w-full bg-transparent text-[16px] outline-none placeholder:text-[#b0b0b0]"
        />
        {searching ? <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-black/10 border-t-black/60" /> : null}
      </label>
      <div className="mt-4">
        {shown.length === 0 && !searching ? (
          <p className="px-2 py-8 text-[15px] text-[#8a8a8a]">
            {isAddress(needle) ? "That contract is not a token on Robinhood Chain." : "No token matches."}
          </p>
        ) : null}
        {shown.map((token) => {
          const active = token.id === selected;
          const balance = held.get(token.id);
          return (
            <button
              key={token.id}
              type="button"
              onClick={() => pick(token)}
              className={`flex w-full items-center gap-4 rounded-2xl px-3 py-4 text-left ${active ? "glass-item-active" : "hover:bg-white/40"}`}
            >
              <TokenLogo token={token} className="h-12 w-12" />
              <span className="min-w-0 flex-1">
                <span className="block text-[18px] font-medium">{token.symbol}</span>
                <span className="block truncate text-[14px] text-[#8a8a8a]">
                  {token.name}
                  {token.address && !["WETH", "USDG"].includes(token.id) ? ` · ${token.address.slice(0, 6)}…${token.address.slice(-4)}` : ""}
                </span>
              </span>
              {balance && balance.balance !== "0" ? (
                <span className="text-right">
                  <span className="block text-[15px] font-medium">{displayAmount(balance.balance)}</span>
                  {balance.usd != null ? <span className="block text-[12px] text-[#8a8a8a]">{money(balance.usd)}</span> : null}
                </span>
              ) : null}
              {active ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
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
      <TokenLogo token={token} className="h-6 w-6" />
      {token.symbol}
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[#8a8a8a]" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 9 L12 15 L18 9" />
      </svg>
    </button>
  );
}
