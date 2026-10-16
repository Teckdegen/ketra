"use client";

import Link from "next/link";
import { useState } from "react";
import { TokenLogo } from "./token-modal";
import { displayAmount } from "@/lib/amount";
import { formatValue, formatValueHint, useBalanceUnit } from "@/lib/display";
import { shortAddress } from "@/lib/format";
import { refreshWallet, useWallet } from "@/lib/use-wallet";
import type { ActivityItem, ActivityKind } from "@/lib/wallet-types";

const EXPLORER = "https://robinhoodchain.blockscout.com";

const titles: Record<ActivityKind, string> = {
  send: "Sent",
  receive: "Received",
  swap: "Swapped",
  wrap: "Wrapped",
  unwrap: "Unwrapped",
  supply: "Supplied",
  deposit: "Deposited",
  withdraw: "Withdrew",
  borrow: "Borrowed",
  liquidity: "Liquidity",
  call: "Contract call",
};

const glyphs: Record<ActivityKind, string> = {
  send: "M7 17 L17 7 M9 7 H17 V15",
  receive: "M17 7 L7 17 M15 17 H7 V9",
  swap: "M7 8 H17 M17 8 L14 5 M17 16 H7 M7 16 L10 19",
  wrap: "M7 8 H17 M17 8 L14 5 M17 16 H7 M7 16 L10 19",
  unwrap: "M7 8 H17 M17 8 L14 5 M17 16 H7 M7 16 L10 19",
  supply: "M12 19 V9 M8 13 L12 9 L16 13 M6 5 H18",
  deposit: "M12 19 V9 M8 13 L12 9 L16 13 M6 5 H18",
  withdraw: "M12 5 V15 M8 11 L12 15 L16 11 M6 19 H18",
  borrow: "M12 5 V15 M8 11 L12 15 L16 11 M6 19 H18",
  liquidity: "M5 12 H19 M12 5 V19",
  call: "M8 8 L4 12 L8 16 M16 8 L20 12 L16 16",
};

function ago(seconds: number) {
  if (!seconds) return "";
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - seconds);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(seconds * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Row({ item }: { item: ActivityItem }) {
  const lead = item.legs.find((leg) => leg.amount.startsWith("-")) ?? item.legs[0];
  const subtitle =
    item.kind === "send" && item.counterparty
      ? `To ${shortAddress(item.counterparty)}`
      : item.kind === "receive" && item.counterparty
        ? `From ${shortAddress(item.counterparty)}`
        : item.kind === "swap" && item.legs.length >= 2
          ? item.legs.map((leg) => leg.token.symbol).join(" → ")
          : shortAddress(item.hash);
  return (
    <a
      href={`${EXPLORER}/tx/${item.hash}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-2xl px-2 py-3 hover:bg-white/40"
    >
      <span className="relative shrink-0">
        {lead ? <TokenLogo token={lead.token} className="h-11 w-11" /> : <span className="block h-11 w-11 rounded-full bg-black/10" />}
        <span className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-black text-white ring-2 ring-white">
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d={glyphs[item.kind]} />
          </svg>
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{titles[item.kind]}</span>
        <span className="block truncate text-[13px] text-[#8a8a8a]">
          {subtitle}
          {item.time ? ` · ${ago(item.time)}` : ""}
        </span>
      </span>
      <span className="shrink-0 text-right">
        {item.legs.slice(0, 2).map((leg) => (
          <span key={leg.token.id} className={`block text-[14px] font-medium ${leg.amount.startsWith("-") ? "" : "text-[#1a7f4b]"}`}>
            {leg.amount.startsWith("-") ? "−" : "+"}
            {displayAmount(leg.amount.replace(/^-/, ""))} {leg.token.symbol}
          </span>
        ))}
      </span>
    </a>
  );
}

export default function Home() {
  const [tab, setTab] = useState<"tokens" | "activity">("tokens");
  const { data, loading, error } = useWallet();
  const unit = useBalanceUnit();
  const assets = data?.assets ?? [];
  const funded = assets.some((asset) => asset.balance !== "0");

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[1.7rem] font-medium tracking-[-0.03em]">Portfolio</h1>
        <button
          type="button"
          onClick={() => void refreshWallet(true)}
          aria-label="Refresh"
          className="glass-field flex h-10 w-10 items-center justify-center rounded-full text-[#3a3a3a]"
        >
          <svg viewBox="0 0 24 24" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.9">
            <path d="M20 12 A8 8 0 1 1 17.7 6.3 M20 4 V9 H15" />
          </svg>
        </button>
      </div>

      <div className="mt-6 glass rounded-[28px] px-6 py-5">
        <p className="text-[13px] text-[#8a8a8a]">Total balance</p>
        {data ? (
          <>
            <p className="mt-3 text-[2.6rem] leading-none font-medium tracking-[-0.04em]">
              {formatValue(data.totalUsd, data.totalEth, unit)}
            </p>
            {formatValueHint(data.totalUsd, data.totalEth, unit) ? (
              <p className="mt-2 text-[14px] text-[#8a8a8a]">{formatValueHint(data.totalUsd, data.totalEth, unit)}</p>
            ) : null}
          </>
        ) : (
          <span className="sign-shimmer mt-3 block h-10 w-44 rounded-2xl" />
        )}
        {error && !data ? <p className="mt-3 text-[13px] text-[#b4471c]">{error}</p> : null}
      </div>

      <div className="mt-6 glass rounded-[28px] px-4 py-6 sm:px-6">
        <div className="flex gap-5 px-2">
          {(["tokens", "activity"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`pb-1 text-[14px] capitalize ${tab === item ? "border-b-2 border-black font-medium" : "text-[#8a8a8a]"}`}
            >
              {item}
            </button>
          ))}
        </div>

        {!data ? (
          <div className="mt-4 space-y-2">
            {[0, 1, 2].map((row) => (
              <span key={row} className="sign-shimmer block h-14 rounded-2xl" />
            ))}
          </div>
        ) : tab === "tokens" ? (
          funded ? (
            <div className="mt-3">
              {assets.map((asset) => (
                <div key={asset.token.id} className="flex items-center gap-3 rounded-2xl px-2 py-3">
                  <TokenLogo token={asset.token} className="h-11 w-11" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium">{asset.token.symbol}</span>
                    <span className="block truncate text-[13px] text-[#8a8a8a]">{asset.token.name}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[15px] font-medium">{displayAmount(asset.balance)}</span>
                    <span className="block text-[13px] text-[#8a8a8a]">{formatValue(asset.usd, asset.eth, unit)}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-2 py-12 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-black text-[13px] font-medium text-white">K</span>
              <h2 className="mt-5 text-[18px] font-medium tracking-[-0.02em]">Fund the account to get started</h2>
              <p className="mx-auto mt-2 max-w-sm text-[14px] leading-6 text-[#8a8a8a]">ETH and tokens show up here after they reach the account.</p>
              <Link href="/receive" className="mt-6 inline-block rounded-lg bg-black px-4 py-2.5 text-[13px] font-medium text-white">
                Receive
              </Link>
            </div>
          )
        ) : data.activity.length ? (
          <div className="mt-3">
            {data.activity.map((item) => (
              <Row key={item.hash} item={item} />
            ))}
          </div>
        ) : (
          <div className="px-2 py-12 text-center">
            <h2 className="text-[18px] font-medium tracking-[-0.02em]">No activity yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-[14px] leading-6 text-[#8a8a8a]">Sends, swaps, deposits and incoming transfers show up here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
