"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Token } from "./tokens";
import type { WalletOverview } from "./wallet-types";
import { readWallets } from "./wallets";

type Snapshot = { account: string; data: WalletOverview | null; error: string; loading: boolean };

const SERVER: Snapshot = { account: "", data: null, error: "", loading: false };
const STALE_MS = 15 * 1000;
const listeners = new Set<() => void>();
let state: Snapshot = SERVER;
let inflight: Promise<void> | null = null;

function emit(next: Partial<Snapshot>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function activeAccount() {
  const saved = readWallets();
  return saved.wallets.find((wallet) => wallet.id === saved.activeId)?.address ?? "";
}

function importKey(account: string) {
  return `ketra-tokens:${account.toLowerCase()}`;
}

export function importedTokens(account: string): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(importKey(account)) || "[]") as unknown;
    return Array.isArray(list) ? list.filter((item): item is string => typeof item === "string" && /^0x[0-9a-fA-F]{40}$/.test(item)) : [];
  } catch {
    return [];
  }
}

/** Remembers a token the user picked by name or contract so its balance and activity are tracked. */
export function rememberToken(token: Token) {
  const account = state.account || activeAccount();
  if (!account || !token.address) return;
  const list = importedTokens(account);
  if (list.some((item) => item.toLowerCase() === token.address!.toLowerCase())) return;
  localStorage.setItem(importKey(account), JSON.stringify([...list, token.address].slice(-40)));
  void refreshWallet(true);
}

export function refreshWallet(fresh = false): Promise<void> {
  const account = activeAccount();
  if (!account) {
    emit({ account: "", data: null, loading: false, error: "" });
    return Promise.resolve();
  }
  if (inflight && !fresh) return inflight;
  emit({ account, loading: true, error: "", data: state.account === account ? state.data : null });
  const request = fetch("/api/wallet", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ account, tokens: importedTokens(account), fresh }),
  })
    .then(async (response) => {
      const text = await response.text();
      try {
        return text ? (JSON.parse(text) as WalletOverview & { error?: string }) : { error: "The wallet could not be read." };
      } catch {
        return { error: "The wallet could not be read." };
      }
    })
    .then((body) => {
      if (activeAccount() !== account) return;
      if (body.error) {
        const message = /cjs\/loader|MODULE_NOT_FOUND|missing a dependency/i.test(body.error)
          ? "Balance is unavailable right now."
          : body.error;
        emit({ loading: false, error: message, data: null });
      } else emit({ loading: false, error: "", data: body as WalletOverview });
    })
    .catch(() => emit({ loading: false, error: "Robinhood Chain did not answer.", data: null }))
    .finally(() => {
      if (inflight === request) inflight = null;
    });
  inflight = request;
  return request;
}

export function useWallet() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => SERVER);
  useEffect(() => {
    const account = activeAccount();
    if (!state.data || state.account !== account || Date.now() - state.data.updated > STALE_MS) void refreshWallet();
    const onFocus = () => {
      if (!state.data || Date.now() - state.data.updated > STALE_MS) void refreshWallet();
    };
    window.addEventListener("focus", onFocus);
    const timer = setInterval(() => void refreshWallet(), 30 * 1000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, []);
  return snapshot;
}

export function balanceOf(data: WalletOverview | null, token: Token) {
  if (!data) return null;
  const match = data.assets.find((asset) => asset.token.id === token.id || (token.address && asset.token.address?.toLowerCase() === token.address.toLowerCase()));
  return match ? match.balance : "0";
}
