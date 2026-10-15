"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PortionButtons } from "../portion";
import { TokenPicker, TokenPill } from "../token-modal";
import type { Quote } from "@/lib/quote";
import { tokens, type Token } from "@/lib/tokens";

const routes: Record<NonNullable<Quote["version"]>, string> = {
  v4: "Uniswap v4",
  v3: "Uniswap v3",
  v2: "Uniswap v2",
  wrap: "Wrap",
};

export default function Swap() {
  const router = useRouter();
  const [payToken, setPayToken] = useState<Token>(tokens[0]);
  const [receiveToken, setReceiveToken] = useState<Token>(tokens[2]);
  const [picking, setPicking] = useState<"pay" | "receive" | null>(null);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);

  useEffect(() => {
    const pay = amount.trim();
    setQuote(null);
    if (!/^\d+(\.\d+)?$/.test(pay) || Number(pay) === 0 || payToken.id === receiveToken.id) {
      setQuote(null);
      setQuoting(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setQuoting(true);
      fetch("/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pay: payToken.id, receive: receiveToken.id, amount: pay }),
        signal: controller.signal,
      })
        .then((response) => response.json())
        .then((next: Quote) => setQuote(next))
        .catch(() => {
          if (!controller.signal.aborted) setQuote({ version: null, amountOut: null });
        })
        .finally(() => {
          if (!controller.signal.aborted) setQuoting(false);
        });
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [amount, payToken, receiveToken]);

  function flip() {
    setPayToken(receiveToken);
    setReceiveToken(payToken);
  }

  function choose(token: Token) {
    if (picking === "pay") {
      if (token.id === receiveToken.id) setReceiveToken(payToken);
      setPayToken(token);
    } else if (picking === "receive") {
      if (token.id === payToken.id) setPayToken(receiveToken);
      setReceiveToken(token);
    }
    setPicking(null);
  }

  const ready = Boolean(quote?.amountOut) && quote?.version !== "wrap" && quote?.version !== null;

  function review(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || !quote?.version || !quote.amountOut) return;
    const query = new URLSearchParams({
      action: "Swap",
      asset: payToken.symbol,
      amount: amount.trim(),
      to: `${quote.amountOut} ${receiveToken.symbol}`,
      route: routes[quote.version],
    });
    router.push(`/sign?${query.toString()}`);
  }

  const button = !/^\d+(\.\d+)?$/.test(amount.trim()) || Number(amount) === 0
    ? "Enter an amount"
    : quoting
      ? "Quoting"
      : quote?.version === "wrap"
        ? "Same asset"
        : ready
          ? "Review"
          : "No route";

  if (picking) {
    return (
      <div className="mx-auto max-w-[640px]">
        <TokenPicker
          tokens={tokens}
          selected={picking === "pay" ? payToken.id : receiveToken.id}
          onClose={() => setPicking(null)}
          onSelect={choose}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[640px]">
      <h1 className="text-[2rem] font-medium tracking-[-0.03em]">Swap</h1>
      <p className="mt-2 text-[15px] text-[#8a8a8a]">The bought tokens come back to the account.</p>

      <form onSubmit={review} className="mt-6 glass rounded-[28px] p-4 sm:p-5">
        <p className="text-[16px] font-medium">Swap</p>

        <div className="relative mt-4">
          <div className="glass-field rounded-2xl px-4 py-4">
            <div className="flex items-end justify-between gap-3">
              <label className="min-w-0 flex-1">
                <span className="text-[13px] text-[#8a8a8a]">You send</span>
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  className="mt-2 w-full bg-transparent text-[2.6rem] leading-none font-medium tracking-[-0.04em] outline-none placeholder:text-[#dedede]"
                />
              </label>
              <TokenPill token={payToken} onClick={() => setPicking("pay")} />
            </div>
            <div className="mt-3 flex items-center justify-end gap-2 text-[13px] text-[#8a8a8a]">
              <span>Balance 0</span>
              <PortionButtons onAmount={setAmount} />
            </div>
          </div>

          <div className="relative h-2">
            <button
              type="button"
              onClick={flip}
              aria-label="Flip tokens"
              className="glass absolute left-1/2 top-1/2 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M7 8 H17 M17 8 L14 5 M17 16 H7 M7 16 L10 19" />
              </svg>
            </button>
          </div>

          <div className="glass-field rounded-2xl px-4 py-4">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-[#8a8a8a]">You receive</p>
                <p className={`mt-2 text-[2.6rem] leading-none font-medium tracking-[-0.04em] ${quote?.amountOut ? "" : "text-[#dedede]"}`}>
                  {quoting && !quote?.amountOut ? "…" : quote?.amountOut || "0"}
                </p>
              </div>
              <TokenPill token={receiveToken} onClick={() => setPicking("receive")} />
            </div>
            {quote?.version && quote.version !== "wrap" ? (
              <p className="mt-3 text-right text-[12px] text-[#8a8a8a]">{routes[quote.version]}</p>
            ) : null}
          </div>
        </div>

        <button
          type="submit"
          disabled={!ready}
          className="mt-4 w-full glass-item rounded-xl py-3.5 text-[15px] text-[#9a9a9a] disabled:cursor-not-allowed enabled:bg-black enabled:text-white"
        >
          {button}
        </button>
      </form>
    </div>
  );
}
