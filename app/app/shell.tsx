"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LockScreen } from "./lock-screen";
import { readWallets, sessionLocked } from "@/lib/wallets";

const items = [
  { href: "/", label: "Portfolio", icon: "grid" },
  { href: "/send", label: "Send", icon: "send" },
  { href: "/swap", label: "Swap", icon: "swap" },
  { href: "/supply", label: "Supply", icon: "supply" },
  { href: "/settings", label: "Settings", icon: "settings" },
] as const;

function Icon({ name, className }: { name: (typeof items)[number]["icon"]; className: string }) {
  if (name === "grid") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <rect x="3" y="3" width="7.5" height="7.5" rx="2" fill="currentColor" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" fill="currentColor" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" fill="currentColor" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" fill="currentColor" />
      </svg>
    );
  }
  if (name === "send") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path fill="currentColor" d="M3.4 11.2 20.2 3.6c.7-.3 1.4.4 1.1 1.1l-7.6 16.8c-.3.7-1.3.7-1.6 0l-2.4-6.1-6.1-2.4c-.7-.3-.7-1.3 0-1.6Z" />
      </svg>
    );
  }
  if (name === "swap") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path fill="currentColor" d="M7 5h9.2L13.6 2.4 15.4.6 20.8 6 15.4 11.4 13.6 9.6 16.2 7H7a3 3 0 0 0-3 3v1H2v-1a5 5 0 0 1 5-5Zm10 14H7.8l2.6 2.6-1.8 1.8L3.2 18l5.4-5.4 1.8 1.8L7.8 17H17a3 3 0 0 0 3-3v-1h2v1a5 5 0 0 1-5 5Z" />
      </svg>
    );
  }
  if (name === "supply") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path fill="currentColor" d="M4 17h16v3H4v-3Z" />
        <path fill="currentColor" d="M11 15V6.8L8.2 9.6 6.8 8.2 12 3l5.2 5.2-1.4 1.4L13 6.8V15h-2Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42L9.25 5.3c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.82a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.64.22l2.39-.96c.5.41 1.05.73 1.63.94l.36 2.54c.05.24.26.42.5.42h3.84c.24 0 .45-.18.5-.42l.36-2.54c.58-.21 1.12-.53 1.63-.94l2.39.96c.25.09.51 0 .64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
      />
    </svg>
  );
}

function activePath(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [entered, setEntered] = useState<boolean | null>(null);
  const [gate, setGate] = useState<"lock" | "open">("open");
  const [accountLabel, setAccountLabel] = useState("No account yet");

  useEffect(() => {
    function sync() {
      if (localStorage.getItem("ketra-rail") === "closed") setOpen(false);
      const state = readWallets();
      const hasAccount = state.wallets.some((wallet) => wallet.address);
      const active = state.wallets.find((wallet) => wallet.id === state.activeId);
      setEntered(hasAccount);
      if (!hasAccount && path !== "/start" && path !== "/create") router.replace("/create");
      setGate(sessionLocked() && hasAccount ? "lock" : "open");
      setAccountLabel(active?.address ? `${active.address.slice(0, 6)}…${active.address.slice(-4)}` : "No account yet");
    }
    sync();
    window.addEventListener("pageshow", sync);
    window.addEventListener("ketra-lock", sync);
    return () => {
      window.removeEventListener("pageshow", sync);
      window.removeEventListener("ketra-lock", sync);
    };
  }, [path, router]);

  const welcome = path === "/start" || path === "/create";
  const hold = !welcome && entered === false;
  const hide = hold || gate !== "open";

  function setRail(next: boolean) {
    setOpen(next);
    localStorage.setItem("ketra-rail", next ? "open" : "closed");
  }

  return (
    <div className="min-h-screen text-[#111]">
      {gate === "lock" ? <LockScreen onUnlock={() => setGate("open")} /> : null}
      <div className={hide ? "invisible" : ""}>
      <aside className={`shell-aside glass fixed top-3 bottom-3 left-3 z-30 w-[248px] flex-col rounded-[28px] px-3 py-5 ${welcome || !open ? "hidden" : "hidden md:flex"}`}>
        <div className="flex items-center justify-between px-3">
          <Link href="/" className="text-[15px] font-bold tracking-[-0.04em] italic">
            KETRA
          </Link>
          <button
            type="button"
            onClick={() => setRail(false)}
            aria-label="Close navigation"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#3a3a3a] hover:bg-white/80"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path fill="currentColor" d="M14.7 6.3 9.1 12l5.6 5.7-1.4 1.4L6.3 12l7-7 1.4 1.3Z" />
            </svg>
          </button>
        </div>
        <nav className="mt-5 flex min-h-0 flex-1 flex-col gap-2">
          {items.map((item) => {
            const active = activePath(path, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 items-center gap-3 rounded-2xl px-3 ${active ? "glass-item-active font-medium" : "glass-item text-[#3a3a3a]"}`}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center">
                  <Icon name={item.icon} className="h-8 w-8" />
                </span>
                <span className="text-[15px]">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <p className="px-3 pt-4 text-[12px] text-[#8a8a8a]">{accountLabel}</p>
      </aside>

      {!welcome && !open ? (
        <button
          type="button"
          onClick={() => setRail(true)}
          aria-label="Open navigation"
          className="shell-rail-toggle glass fixed top-4 left-4 z-30 hidden h-11 w-11 items-center justify-center rounded-2xl text-[#111] md:flex"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path fill="currentColor" d="M9.3 6.3 14.9 12l-5.6 5.7 1.4 1.4 7-7-7-7-1.4 1.3Z" />
          </svg>
        </button>
      ) : null}

      <div className={`shell-main min-w-0 pb-32 transition-[padding] duration-200 md:pb-8 ${welcome ? "pb-0" : open ? "md:pl-[276px]" : "md:pl-[76px]"}`}>
        <div key={gate} className={welcome ? "" : "px-5 py-8 md:px-10 md:py-9"}>
          {children}
        </div>
      </div>

      <nav className={`shell-tabbar glass fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-[26px] px-1 pt-1 pb-[max(6px,env(safe-area-inset-bottom))] md:hidden ${welcome ? "!hidden" : ""}`}>
        {items.map((item) => {
          const active = activePath(path, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-2xl text-[10px] ${active ? "glass-item-active font-medium text-black" : "text-[#6a6a6a]"}`}
            >
              <Icon name={item.icon} className="h-6 w-6" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      </div>
    </div>
  );
}
