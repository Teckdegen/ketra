"use client";

import { useEffect, useSyncExternalStore } from "react";
import { money } from "./format";

export type BalanceUnit = "usd" | "eth";

const KEY = "ketra-balance-unit";
const listeners = new Set<() => void>();
let unit: BalanceUnit = "usd";
let ready = false;

function emit() {
  listeners.forEach((listener) => listener());
}

function read(): BalanceUnit {
  try {
    const value = localStorage.getItem(KEY);
    return value === "eth" ? "eth" : "usd";
  } catch {
    return "usd";
  }
}

function ethLabel(value: number) {
  const abs = Math.abs(value);
  const text =
    abs >= 1000 ? abs.toFixed(2) : abs >= 1 ? abs.toFixed(4) : abs >= 0.0001 ? abs.toFixed(6) : abs === 0 ? "0" : abs.toPrecision(4);
  return `${value < 0 ? "-" : ""}${text} ETH`;
}

export function setBalanceUnit(next: BalanceUnit) {
  unit = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {}
  emit();
}

export function useBalanceUnit() {
  useEffect(() => {
    if (!ready) {
      unit = read();
      ready = true;
      emit();
    }
  }, []);
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => unit,
    () => "usd" as BalanceUnit,
  );
}

/** Primary label for a valued balance, following the settings toggle. */
export function formatValue(usd: number | null | undefined, eth: number | null | undefined, preference: BalanceUnit) {
  if (preference === "eth") return eth == null ? "—" : ethLabel(eth);
  return usd == null ? "—" : money(usd);
}

/** Secondary label under the primary amount. */
export function formatValueHint(usd: number | null | undefined, eth: number | null | undefined, preference: BalanceUnit) {
  if (preference === "eth") return usd == null ? "" : money(usd);
  return eth == null ? "" : ethLabel(eth);
}
