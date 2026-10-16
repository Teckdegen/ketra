"use client";

import { useEffect, useRef, useState } from "react";

const SLOTS = 12;

export function SeedPhraseView({ phrase, onCopy, onNext }: { phrase: string; onCopy: () => void | Promise<void>; onNext: () => void }) {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  const [backedUp, setBackedUp] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await onCopy();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

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
        onClick={() => void copy()}
        className="glass-field mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[13px] font-medium tracking-[0.14em]"
      >
        {copied ? "COPIED" : "COPY TO CLIPBOARD"}
        {copied ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M5 12 L10 17 L19 7" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <rect x="8" y="8" width="11" height="12" rx="2" />
            <path d="M6 16 H5 a2 2 0 0 1 -2 -2 V5 a2 2 0 0 1 2 -2 h8 a2 2 0 0 1 2 2 v1" />
          </svg>
        )}
      </button>
      <label className="mt-4 flex items-center justify-center gap-2 text-[14px]">
        <input type="checkbox" checked={backedUp} onChange={(event) => setBackedUp(event.target.checked)} className="h-4 w-4 accent-black" />
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

/** Numbered word boxes for importing a seed phrase, matching the backup layout. */
export function SeedPhraseEntry({ value, onChange }: { value: string; onChange: (phrase: string) => void }) {
  const parts = value.trim() ? value.trim().toLowerCase().split(/\s+/).filter(Boolean) : [];
  const count = parts.length > 12 ? 24 : SLOTS;
  const words = Array.from({ length: count }, (_, index) => parts[index] ?? "");
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current = refs.current.slice(0, count);
  }, [count]);

  function emit(next: string[]) {
    onChange(next.map((word) => word.trim().toLowerCase()).filter(Boolean).join(" "));
  }

  function setWord(index: number, raw: string) {
    const cleaned = raw.toLowerCase().replace(/[^a-z]/g, "");
    if (raw.includes(" ") || raw.includes("\n") || raw.includes("\t")) {
      const pasted = raw.toLowerCase().split(/[\s,]+/).filter(Boolean);
      if (pasted.length > 1) {
        const size = pasted.length > 12 ? 24 : 12;
        const next = Array.from({ length: size }, (_, i) => pasted[i] ?? "");
        emit(next);
        const focus = Math.min(pasted.length, size - 1);
        queueMicrotask(() => refs.current[focus]?.focus());
        return;
      }
    }
    const next = [...words];
    while (next.length < count) next.push("");
    next[index] = cleaned;
    emit(next);
  }

  async function pasteAll() {
    try {
      const text = await navigator.clipboard.readText();
      const pasted = text.toLowerCase().split(/[\s,]+/).filter(Boolean);
      if (!pasted.length) return;
      const size = pasted.length > 12 ? 24 : 12;
      emit(Array.from({ length: size }, (_, i) => pasted[i] ?? ""));
    } catch {
      /* Browser blocked clipboard. User can still paste into a box. */
    }
  }

  return (
    <div className="text-left">
      <ol className="mt-5 grid max-h-[min(42vh,300px)] grid-cols-2 gap-2 overflow-y-auto pr-1">
        {words.map((word, index) => (
          <li key={index} className="glass-field flex items-center gap-3 rounded-2xl px-3 py-2.5">
            <span className="w-5 shrink-0 text-[13px] text-[#8a8a8a]">{index + 1}</span>
            <input
              ref={(node) => {
                refs.current[index] = node;
              }}
              value={word}
              onChange={(event) => setWord(index, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault();
                  refs.current[Math.min(index + 1, count - 1)]?.focus();
                } else if (event.key === "Backspace" && !word && index > 0) {
                  refs.current[index - 1]?.focus();
                }
              }}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              className="w-full bg-transparent text-[15px] font-medium outline-none"
            />
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => void pasteAll()}
        className="glass-field mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[13px] font-medium tracking-[0.14em]"
      >
        PASTE
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <rect x="8" y="8" width="11" height="12" rx="2" />
          <path d="M6 16 H5 a2 2 0 0 1 -2 -2 V5 a2 2 0 0 1 2 -2 h8 a2 2 0 0 1 2 2 v1" />
        </svg>
      </button>
    </div>
  );
}
