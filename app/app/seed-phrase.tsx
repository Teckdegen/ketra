"use client";

import { useState } from "react";

export function SeedPhraseView({ phrase, onCopy, onNext }: { phrase: string; onCopy: () => void; onNext: () => void }) {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  const [backedUp, setBackedUp] = useState(false);

  return (
    <div className="text-left">
      <h2 className="text-center text-[13px] font-medium tracking-[0.16em]">YOUR SEED PHRASE</h2>
      <p className="mx-auto mt-4 max-w-[340px] text-center text-[14px] leading-6 text-[#6a6a6a]">
        Please note down the seed phrase in order.
        <br />
        This is the only way to recover your wallet.
        <br />
        Do not screenshot this nor share with anyone.
      </p>
      <ol className="mt-5 grid max-h-[300px] grid-cols-2 gap-2 overflow-y-auto pr-1">
        {words.map((word, index) => (
          <li key={index} className="glass-field flex items-center gap-3 rounded-2xl px-4 py-3">
            <span className="w-5 shrink-0 text-[13px] text-[#8a8a8a]">{index + 1}</span>
            <span className="text-[15px] font-medium">{word}</span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onCopy}
        className="glass-field mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[13px] font-medium tracking-[0.14em]"
      >
        COPY TO CLIPBOARD
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <rect x="8" y="8" width="11" height="12" rx="2" />
          <path d="M6 16 H5 a2 2 0 0 1 -2 -2 V5 a2 2 0 0 1 2 -2 h8 a2 2 0 0 1 2 2 v1" />
        </svg>
      </button>
      <label className="mt-4 flex items-center justify-center gap-2 text-[14px]">
        <input
          type="checkbox"
          checked={backedUp}
          onChange={(event) => setBackedUp(event.target.checked)}
          className="h-4 w-4 accent-black"
        />
        I&apos;ve backed up the seed phrase.
      </label>
      <button
        type="button"
        onClick={onNext}
        disabled={!backedUp}
        className="mt-4 h-12 w-full rounded-full bg-black text-[14px] font-medium tracking-[0.14em] text-white disabled:opacity-40"
      >
        NEXT
      </button>
    </div>
  );
}
