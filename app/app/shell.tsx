"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark, IconPortfolio, IconSend, IconSettings, IconSupply, IconSwap } from "./icons";
import { LockScreen } from "./lock-screen";
import { clearOrphanLock, hasDeviceWallet, readWallets, sessionLocked } from "@/lib/wallets";

const items = [
  { href: "/", label: "Portfolio", Icon: IconPortfolio },
  { href: "/send", label: "Send", Icon: IconSend },
  { href: "/swap", label: "Swap", Icon: IconSwap },
  { href: "/supply", label: "Supply", Icon: IconSupply },
  { href: "/settings", label: "Settings", Icon: IconSettings },
] as const;

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
      clearOrphanLock();
      const state = readWallets();
      const hasWallet = hasDeviceWallet();
      const active = state.wallets.find((wallet) => wallet.id === state.activeId);
      setEntered(hasWallet);
      if (!hasWallet && path !== "/start" && path !== "/create") router.replace("/create");
      setGate(sessionLocked() && hasWallet ? "lock" : "open");
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
            <Link href="/" className="flex items-center gap-2.5">
              <BrandMark className="h-8 w-8 rounded-[10px]" />
              <span className="text-[15px] font-bold tracking-[-0.04em] italic">KETRA</span>
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
              const Icon = item.Icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-1 items-center gap-3 rounded-2xl px-3 ${active ? "glass-item-active font-medium" : "glass-item text-[#3a3a3a]"}`}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center">
                    <Icon className="h-7 w-7" />
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
            const Icon = item.Icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-2xl text-[10px] ${active ? "glass-item-active font-medium text-black" : "text-[#6a6a6a]"}`}
              >
                <Icon className="h-6 w-6" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
