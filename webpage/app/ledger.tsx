"use client";

import { useState } from "react";

const tabs = [
  {
    id: "spend",
    title: "Spend",
    body: "The account holds the ETH and the tokens. An ML-DSA-44 signature is the only thing that moves them.",
    link: "Ketra spend",
  },
  {
    id: "replay",
    title: "Replay",
    body: "The nonce steps forward after a batch succeeds. Submitting that same signature again is rejected.",
    link: "Nonce check",
  },
  {
    id: "chains",
    title: "Chains",
    body: "The account spends ETH on Robinhood Chain. That is the only chain.",
    link: "Robinhood ETH",
  },
] as const;

type TabId = (typeof tabs)[number]["id"];

const ranges = ["1W", "1M", "1Y"] as const;

function barsFor(range: (typeof ranges)[number]) {
  const count = range === "1W" ? 16 : range === "1M" ? 36 : 56;
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    return 8 + Math.round(Math.pow(t, 1.45) * 92);
  });
}

export function Ledger() {
  const [tab, setTab] = useState<TabId>("spend");
  const [range, setRange] = useState<(typeof ranges)[number]>("1M");
  const bars = barsFor(range);
  const axis =
    range === "1W" ? ["Mon", "Today"] : range === "1M" ? ["Aug", "Today"] : ["2025", "Today"];

  return (
    <section id="ledger" className="relative z-10 mx-auto max-w-[1180px] scroll-mt-24 px-5 pt-8 pb-28 sm:px-8">
      <div className="grid items-stretch gap-8 lg:grid-cols-[300px_1fr] lg:gap-14">
        <div className="flex flex-col border-t border-[#e6e6e6]">
          {tabs.map((item) => {
            const open = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className="border-b border-[#e6e6e6] py-7 text-left"
              >
                <span className={`block text-[22px] leading-none font-medium tracking-[-0.03em] ${open ? "text-black" : "text-[#c8c8c8]"}`}>
                  {item.title}
                </span>
                {open ? (
                  <>
                    <span className="mt-3 block max-w-[280px] text-[13px] leading-5 text-[#6d6d6d]">{item.body}</span>
                    <span className="mt-4 block text-[13px] text-[#9a9a9a]">
                      {item.link} <span className="text-[#c8c8c8]">›</span>
                    </span>
                  </>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex min-h-[560px] items-center justify-center rounded-[32px] bg-[#ececec] px-6 py-10">
          {tab === "spend" ? (
            <div className="w-full max-w-[460px] rounded-[24px] bg-white px-6 pt-5 pb-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="flex items-start justify-between">
                <p className="text-[13px] text-[#8a8a8a]">Balance</p>
                <span className="rounded-full bg-[#e7f8ef] px-2 py-0.5 text-[12px] font-medium text-[#1f9d62]">signed</span>
              </div>
              <p className="mt-2 text-[28px] leading-none font-medium tracking-[-0.04em] text-black">1,000</p>
              <div className="mt-8 flex h-[120px] items-end gap-[3px]">
                {bars.map((height, index) => (
                  <span
                    key={index}
                    className="flex-1 rounded-[1px] bg-[#c4b6f6]"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[12px] text-[#b0b0b0]">
                <span>{axis[0]}</span>
                <span>{axis[1]}</span>
              </div>
              <div className="mt-4 flex gap-2">
                {ranges.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setRange(item)}
                    className={`rounded-full px-3 py-1 text-[13px] ${
                      range === item ? "bg-[#f3f3f3] font-medium text-black" : "text-[#b0b0b0]"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {tab === "replay" ? (
            <div className="w-full max-w-[340px] rounded-[24px] bg-white px-4 pt-4 pb-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between px-1">
                <p className="text-[13px] text-[#8a8a8a]">Replay</p>
                <span className="flex items-center gap-1.5 text-[12px] text-[#1f9d62]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1f9d62]" />
                  Nonce
                </span>
              </div>
              <div className="mt-3 rounded-2xl border border-[#efefef] px-4 py-3">
                <p className="text-[12px] text-[#b0b0b0]">First</p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-[28px] leading-none font-medium tracking-[-0.04em]">0</p>
                  <span className="text-[12px] font-medium text-[#6d6d6d]">ML-DSA</span>
                </div>
              </div>
              <div className="mt-2 rounded-2xl border border-[#efefef] px-4 py-3">
                <p className="text-[12px] text-[#b0b0b0]">Second</p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-[28px] leading-none font-medium tracking-[-0.04em]">1</p>
                  <span className="text-[12px] font-medium text-[#6d6d6d]">Stopped</span>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between rounded-2xl bg-[#f6f6f6] px-4 py-3 text-[12px] text-[#8a8a8a]">
                <span>Same signature</span>
                <span>Rejected</span>
              </div>
              <div className="mt-3 rounded-full bg-black py-3 text-center text-[14px] font-medium text-white">Stopped</div>
            </div>
          ) : null}

          {tab === "chains" ? (
            <img src="/logos/robinhood.svg" alt="Robinhood" className="h-20 w-auto brightness-0" />
          ) : null}
        </div>
      </div>
    </section>
  );
}
