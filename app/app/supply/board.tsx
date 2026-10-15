"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { money, percent } from "@/lib/format";
import type { ListedMarket } from "@/lib/morpho";

const sources = ["All", "Morpho", "Steakhouse"] as const;

function Marks({ row }: { row: ListedMarket }) {
  const parts = [
    { logo: row.collateralLogo, symbol: row.collateralSymbol },
    { logo: row.loanLogo, symbol: row.loanSymbol },
  ];
  return (
    <span className="flex">
      {parts.map((part, index) =>
        part.logo ? (
          <img
            key={`${part.symbol}-${index}`}
            src={part.logo}
            alt=""
            className="-ml-1.5 h-6 w-6 rounded-full bg-white object-contain ring-2 ring-white first:ml-0"
          />
        ) : (
          <span
            key={`${part.symbol}-${index}`}
            className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#111] text-[10px] text-white ring-2 ring-white first:ml-0"
          >
            {part.symbol.slice(0, 1)}
          </span>
        ),
      )}
    </span>
  );
}

export function SupplyBoard({ rows }: { rows: ListedMarket[] }) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<(typeof sources)[number]>("All");
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (source !== "All" && row.source !== source) return false;
      if (!needle) return true;
      return `${row.collateralSymbol} ${row.loanSymbol} ${row.source} ${row.by}`.toLowerCase().includes(needle);
    });
  }, [query, rows, source]);
  const featured = rows.find((row) => row.supplyUsd > 0) ?? rows[0];

  return (
    <div>
      <h1 className="text-[2rem] font-medium tracking-[-0.03em]">Supply</h1>
      <p className="mt-2 text-[15px] text-[#8a8a8a]">
        Every Morpho market on Robinhood, including Steakhouse. {rows.length} markets.
      </p>

      <div className="mt-6 glass rounded-[28px] p-5 sm:p-6">
        <p className="text-[13px] text-[#8a8a8a]">Your deposits</p>
        <p className="mt-2 text-[2.6rem] leading-none font-medium tracking-[-0.04em]">0</p>
        <p className="mt-3 text-[14px] text-[#8a8a8a]">No position yet</p>
        {featured ? (
          <Link href={`/supply/${featured.id}`} className="mt-4 flex items-center justify-between gap-4 glass-field rounded-xl px-4 py-4">
            <span>
              <span className="block text-[12px] text-[#8a8a8a]">
                {featured.collateralSymbol} / {featured.loanSymbol}
              </span>
              <span className="mt-1 block text-[1.4rem] font-medium tracking-[-0.03em]">{percent(featured.apy)}</span>
              <span className="mt-1 block text-[13px] text-[#8a8a8a]">
                {money(featured.supplyUsd)} supplied. {featured.by}.
              </span>
            </span>
            <Marks row={featured} />
          </Link>
        ) : null}
      </div>

      <div className="mt-8 glass rounded-[28px] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="glass-field flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-4 py-3">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#9a9a9a]" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="6" />
              <path d="M16 16 L20 20" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search collateral or loan"
              className="w-full bg-transparent text-[15px] outline-none placeholder:text-[#b0b0b0]"
            />
          </label>
          <div className="flex gap-2">
            {sources.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSource(item)}
                className={`rounded-full px-3 py-2 text-[13px] ${source === item ? "bg-black text-white" : "glass-field"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <div className="grid min-w-[640px] grid-cols-[1.4fr_0.6fr_0.6fr_0.6fr] px-2 py-3 text-[12px] text-[#8a8a8a]">
            <span>Market</span>
            <span>APY</span>
            <span>Supplied</span>
            <span>Liquidity</span>
          </div>
          {shown.length === 0 ? <p className="px-2 py-8 text-[14px] text-[#8a8a8a]">No market matches.</p> : null}
          {shown.map((row) => (
            <Link
              key={row.id}
              href={`/supply/${row.id}`}
              className="grid min-w-[640px] grid-cols-[1.4fr_0.6fr_0.6fr_0.6fr] items-center border-t border-white/50 px-2 py-4"
            >
              <span className="flex items-center gap-3">
                <Marks row={row} />
                <span>
                  <span className="block text-[14px] font-medium">
                    {row.collateralSymbol} / {row.loanSymbol}
                  </span>
                  <span className="block text-[12px] text-[#8a8a8a]">{row.by}</span>
                </span>
              </span>
              <span className="text-[14px]">{percent(row.apy)}</span>
              <span className="text-[14px]">{money(row.supplyUsd)}</span>
              <span className="text-[14px] text-[#8a8a8a]">{money(row.liquidityUsd)}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
