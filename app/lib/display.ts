"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore, type MouseEvent, type PointerEvent } from "react";
import { money } from "./format";

export type BalanceUnit = "usd" | "eth";

const KEY = "ketra-balance-unit";
const HIDE_KEY = "ketra-hide-balance";
const listeners = new Set<() => void>();
const hideListeners = new Set<() => void>();
let unit: BalanceUnit = "usd";
let ready = false;
let hidden = false;
let hideReady = false;

function emit() {
  listeners.forEach((listener) => listener());
}

function emitHide() {
  hideListeners.forEach((listener) => listener());
}

function read(): BalanceUnit {
  try {
    const value = localStorage.getItem(KEY);
    return value === "eth" ? "eth" : "usd";
  } catch {
    return "usd";
  }
}

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
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

/** Primary label for a valued balance, following the settings toggle. Empty wallets show zero. */
export function formatValue(usd: number | null | undefined, eth: number | null | undefined, preference: BalanceUnit) {
  if (preference === "eth") return ethLabel(eth ?? 0);
  return money(usd ?? 0);
}

/** Secondary label under the primary amount. */
export function formatValueHint(usd: number | null | undefined, eth: number | null | undefined, preference: BalanceUnit) {
  if (preference === "eth") return usd == null ? "" : money(usd);
  return eth == null ? "" : ethLabel(eth);
}

export function setBalanceHidden(next: boolean) {
  hidden = next;
  try {
    localStorage.setItem(HIDE_KEY, next ? "1" : "0");
  } catch {}
  emitHide();
}

export function toggleBalanceHidden() {
  setBalanceHidden(!hidden);
}

export function useBalanceHidden() {
  useEffect(() => {
    if (!hideReady) {
      hidden = readHidden();
      hideReady = true;
      emitHide();
    }
  }, []);
  return useSyncExternalStore(
    (listener) => {
      hideListeners.add(listener);
      return () => hideListeners.delete(listener);
    },
    () => hidden,
    () => false,
  );
}

/** Mask a money string with asterisks that roughly match length. */
export function maskAmount(value: string) {
  const digits = value.replace(/[^0-9]/g, "").length;
  return "•".repeat(Math.min(10, Math.max(4, digits || 4)));
}

const LONG_PRESS_MS = 420;

/** Long-press handlers that toggle balance privacy without stealing clicks. */
export function useLongPressToggle(onToggle: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (event: PointerEvent) => {
      if (event.button !== 0) return;
      fired.current = false;
      clear();
      timer.current = setTimeout(() => {
        fired.current = true;
        onToggle();
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(12);
          } catch {}
        }
      }, LONG_PRESS_MS);
    },
    [clear, onToggle],
  );

  const onPointerUp = useCallback(() => {
    clear();
  }, [clear]);

  const onPointerLeave = useCallback(() => {
    clear();
  }, [clear]);

  const onContextMenu = useCallback((event: MouseEvent) => {
    event.preventDefault();
  }, []);

  useEffect(() => () => clear(), [clear]);

  return { onPointerDown, onPointerUp, onPointerLeave, onPointerCancel: onPointerUp, onContextMenu };
}
