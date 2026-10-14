"use client";

import { useState } from "react";

const tabs = [
  {
    id: "authorization",
    title: "Account",
    body: "ETH and tokens sit on the Ketra account. The key that pays gas can submit a transaction. It cannot spend.",
    link: "Ketra account",
  },
  {
    id: "developers",
    title: "Calls",
    body: "One signature covers the swap, the Morpho supply, the Steakhouse deposit, or the Lighter margin. The approval is cleared in that same batch.",
    link: "Signed batch",
  },
  {
    id: "chains",
    title: "Chains",
    body: "The account runs on Robinhood Chain and on Flare Coston2. The chain id is part of every signature.",
    link: "Where it runs",
  },
] as const;

const ranges = ["1W", "1M", "1Y"] as const;

const bars = Array.from({ length: 46 }, (_, index) => {
  const t = index / 45;
  return Math.round(8 + Math.pow(t, 1.45) * 92);
});

export function ProductSection() {
  const [active, setActive] = useState<(typeof tabs)[number]["id"]>("authorization");
  const [range, setRange] = useState<(typeof ranges)[number]>("1M");
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  return (
    <section id="product" className="relative z-10 mx-auto max-w-[1120px] scroll-mt-24 px-5 pt-20 pb-28 sm:px-8">
      <div className="grid items-start gap-6 lg:grid-cols-[320px_1fr] lg:gap-10">
        <div>
          {tabs.map((tab, index) => {
            const selected = tab.id === active;
            return (
              <div key={tab.id} className={index > 0 ? "border-t border-[#e3e3e3]" : undefined}>
                <button
                  id={tab.id}
                  type="button"
                  onClick={() => setActive(tab.id)}
                  className="w-full py-8 text-left"
                >
                  <span className={`block text-[32px] leading-none font-semibold tracking-[-0.03em] ${selected ? "text-black" : "text-[#bdbdbd]"}`}>
                    {tab.title}
                  </span>
                  {selected ? (
                    <>
                      <p id={tab.id === "developers" ? "docs" : undefined} className="mt-4 max-w-[34ch] text-[15px] leading-6 text-[#8a8a8a]">
                        {tab.body}
                      </p>
                      <span className="mt-6 inline-block text-[14px] text-[#9a9a9a]">{tab.link} ›</span>
                    </>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex min-h-[560px] items-center justify-center rounded-[28px] bg-[#ececec] p-6 sm:p-10">
          {active === "authorization" ? (
            <div className="w-full max-w-[440px] rounded-[24px] bg-white px-6 pt-5 pb-5 shadow-[0_10px_40px_rgba(0,0,0,0.04)]">
              <div className="flex items-start justify-between">
                <p className="text-[13px] text-[#9a9a9a]">Balance</p>
                <span className="rounded-full bg-[#e7f6ee] px-2 py-0.5 text-[12px] font-medium text-[#1f9d57]">ML-DSA</span>
              </div>
              <p className="mt-3 text-[34px] leading-none font-semibold tracking-[-0.03em] text-black">$4,820.16</p>
              <div className="mt-8 flex h-28 items-end gap-[3px]">
                {bars.map((height, index) => (
                  <span
                    key={index}
                    className="flex-1 rounded-[1px] bg-[#c4b5fd]"
                    style={{ height: `${range === "1W" ? Math.max(18, height - 20) : range === "1Y" ? Math.min(100, height + 8) : height}%` }}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[12px] text-[#b0b0b0]">
                <span>Aug</span>
                <span>Today</span>
              </div>
              <div className="mt-4 flex gap-2">
                {ranges.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setRange(item)}
                    className={`rounded-full px-3 py-1 text-[13px] ${item === range ? "bg-[#f4f4f4] font-medium text-black shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-[#b0b0b0]"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="w-full max-w-[440px] rounded-[24px] bg-white px-6 py-6 shadow-[0_10px_40px_rgba(0,0,0,0.04)]">
              <p className="text-[13px] text-[#9a9a9a]">{current.title}</p>
              <p className="mt-3 text-[22px] leading-snug font-semibold tracking-[-0.03em]">{current.body}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
