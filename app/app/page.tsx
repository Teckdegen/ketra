"use client";

import Link from "next/link";
import { useState } from "react";

export default function Home() {
  const [tab, setTab] = useState<"tokens" | "activity">("tokens");

  return (
    <div>
      <h1 className="text-[1.7rem] font-medium tracking-[-0.03em]">Portfolio</h1>

      <div className="mt-6 glass rounded-[28px] px-6 py-5">
        <p className="text-[13px] text-[#8a8a8a]">Total balance</p>
        <p className="mt-3 text-[2.6rem] leading-none font-medium tracking-[-0.04em]">0 ETH</p>
      </div>

      <div className="mt-6 glass rounded-[28px] px-6 py-6">
        <div className="flex gap-5">
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

        {tab === "tokens" ? (
          <div className="px-2 py-12 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-black text-[13px] font-medium text-white">
              K
            </span>
            <h2 className="mt-5 text-[18px] font-medium tracking-[-0.02em]">Fund the account to get started</h2>
            <p className="mx-auto mt-2 max-w-sm text-[14px] leading-6 text-[#8a8a8a]">
              ETH and tokens show up here after they reach the account.
            </p>
            <Link href="/receive" className="mt-6 inline-block rounded-lg bg-black px-4 py-2.5 text-[13px] font-medium text-white">
              Receive
            </Link>
          </div>
        ) : (
          <div className="px-2 py-12 text-center">
            <h2 className="text-[18px] font-medium tracking-[-0.02em]">No spends yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-[14px] leading-6 text-[#8a8a8a]">
              Signed batches show up here. Nothing has moved.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
