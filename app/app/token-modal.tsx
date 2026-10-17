"use client";

import { useEffect, useMemo, useState } from "react";
import { displayAmount } from "@/lib/amount";
import { formatValue, useBalanceUnit } from "@/lib/display";
import { isAddress, type Token } from "@/lib/tokens";
import { rememberToken, useWallet } from "@/lib/use-wallet";

function ipfsFallback(url: string) {
  const match = url.match(/\/ipfs\/(.+)$/i) || url.match(/^ipfs:\/\/(.+)$/i);
  if (!match?.[1]) return null;
  const path = match[1].replace(/^ipfs\//, "");
  const gates = [
    `https://gateway.pinata.cloud/ipfs/${path}`,
    `https://dweb.link/ipfs/${path}`,
    `https://ipfs.io/ipfs/${path}`,
  ];
  const next = gates.find((gate) => gate !== url);
  return next ?? null;
}

export function TokenLogo({ token, className = "h-6 w-6" }: { token: Pick<Token, "logo" | "symbol">; className?: string }) {
  const [src, setSrc] = useState(token.logo);
  useEffect(() => setSrc(token.logo), [token.logo]);
  if (!src) {
    return (
      <span className={`${className} flex shrink-0 items-center justify-center rounded-full bg-black text-[40%] font-medium text-white`}>
        {token.symbol.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      onError={() => {
        const next = ipfsFallback(src);
        if (next) setSrc(next);
        else setSrc("");
      }}
      className={`${className} shrink-0 rounded-full bg-white object-cover`}
    />
  );
}

export function TokenPicker({
  tokens,
  selected,
  onSelect,
  onClose,
  searchable = true,
  heldOnly = false,
}: {
  tokens: Token[];
  selected: string;
  onSelect: (token: Token) => void;
  onClose: () => void;
  searchable?: boolean;
  /** Pay / send: only non-zero balances. */
  heldOnly?: boolean;
}) {
  const { data } = useWallet();
  const unit = useBalanceUnit();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ query: string; tokens: Token[] } | null>(null);
  const needle = query.trim();
  // Auto-search as you type: empty = browse trending, 1+ chars or a CA = live search. No button.
  const remote = searchable && !heldOnly && (needle === "" || isAddress(needle) || needle.length >= 1);
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
    }, needle === "" ? 0 : 150);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [remote, needle]);

  const held = useMemo(() => {
    const map = new Map<string, { balance: string; eth: number | null; usd: number | null; token: Token }>();
    data?.assets.forEach((asset) => {
      if (asset.balance !== "0") map.set(asset.token.id, { balance: asset.balance, eth: asset.eth, usd: asset.usd, token: asset.token });
    });
    return map;
  }, [data]);

  const groups = useMemo(() => {
    const lower = needle.toLowerCase();
    const match = (token: Token) =>
      !lower ||
      token.symbol.toLowerCase().includes(lower) ||
      token.name.toLowerCase().includes(lower) ||
      token.address?.toLowerCase() === lower;

    if (heldOnly) {
      return {
        held: [...held.values()]
          .map((item) => item.token)
          .filter(match)
          .sort((a, b) => (held.get(b.id)?.usd ?? held.get(b.id)?.eth ?? -1) - (held.get(a.id)?.usd ?? held.get(a.id)?.eth ?? -1)),
        rest: [] as Token[],
      };
    }

    const heldList = [...held.values()]
      .map((item) => item.token)
      .filter(match)
      .sort((a, b) => (held.get(b.id)?.usd ?? held.get(b.id)?.eth ?? -1) - (held.get(a.id)?.usd ?? held.get(a.id)?.eth ?? -1));

    const remoteList = remote && found?.query === needle ? found.tokens : [];
    const catalog = [...tokens, ...remoteList];
    const seen = new Set(heldList.map((token) => token.id));
    const rest: Token[] = [];
    for (const token of catalog) {
      if (seen.has(token.id) || !match(token)) continue;
      seen.add(token.id);
      rest.push(token);
    }
    return { held: heldList, rest };
  }, [heldOnly, held, needle, tokens, remote, found]);

  const empty = groups.held.length === 0 && groups.rest.length === 0 && !searching;

  function pick(token: Token) {
    if (token.address && !tokens.some((item) => item.id === token.id)) rememberToken(token);
    onSelect(token);
  }

  function Row({ token }: { token: Token }) {
    const active = token.id === selected;
    const balance = held.get(token.id);
    return (
      <button
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
        {balance ? (
          <span className="text-right">
            <span className="block text-[15px] font-medium">{displayAmount(balance.balance)}</span>
            <span className="block text-[12px] text-[#8a8a8a]">{formatValue(balance.usd, balance.eth, unit)}</span>
          </span>
        ) : null}
        {active ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12 L10 17 L19 7" />
          </svg>
        ) : null}
      </button>
    );
  }

  return (
    <div className="glass min-h-[560px] rounded-[28px] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[1.7rem] font-medium tracking-[-0.03em]">{heldOnly ? "Pay with" : "Receive"}</h2>
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
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
          placeholder={heldOnly ? "Filter what you hold" : "Type a name or paste a contract"}
          spellCheck={false}
          className="w-full bg-transparent text-[16px] outline-none placeholder:text-[#b0b0b0]"
        />
        {searching ? <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-black/10 border-t-black/60" /> : null}
      </label>
      <div className="mt-4">
        {empty ? (
          <p className="px-2 py-8 text-[15px] text-[#8a8a8a]">
            {heldOnly
              ? "No tokens in this wallet yet."
              : isAddress(needle)
                ? "That contract is not a token on Robinhood Chain."
                : "No token matches."}
          </p>
        ) : null}
        {groups.held.length ? (
          <div>
            {!heldOnly ? <p className="px-3 pb-1 text-[12px] font-medium tracking-wide text-[#8a8a8a] uppercase">You hold</p> : null}
            {groups.held.map((token) => (
              <Row key={token.id} token={token} />
            ))}
          </div>
        ) : null}
        {groups.rest.length ? (
          <div className={groups.held.length ? "mt-3" : ""}>
            <p className="px-3 pb-1 text-[12px] font-medium tracking-wide text-[#8a8a8a] uppercase">
              {needle ? "Results" : "On Robinhood"}
            </p>
            {groups.rest.map((token) => (
              <Row key={token.id} token={token} />
            ))}
          </div>
        ) : null}
        {searching && groups.held.length === 0 && groups.rest.length === 0 ? (
          <p className="px-2 py-8 text-[15px] text-[#8a8a8a]">Searching…</p>
        ) : null}
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
