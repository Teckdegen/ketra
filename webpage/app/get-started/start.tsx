"use client";

import { useState } from "react";

const CHROME_STORE =
  process.env.NEXT_PUBLIC_CHROME_STORE_URL || "https://chromewebstore.google.com/detail/ketra";

const DESKTOP = {
  mac: { label: "macOS", href: "/api/download/mac" },
  windows: { label: "Windows", href: "/api/download/windows" },
  linux: { label: "Linux", href: "/api/download/linux" },
} as const;

type DesktopTarget = keyof typeof DESKTOP | null;

function ChromeLogo({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="20" fill="#fff" />
      <path fill="#EA4335" d="M24 4a20 20 0 0 1 17.32 10H24z" />
      <path fill="#FBBC05" d="M41.32 14A20 20 0 0 1 34 41.32L24 24z" />
      <path fill="#34A853" d="M34 41.32A20 20 0 0 1 6.68 14L24 24z" />
      <path fill="#4285F4" d="M6.68 14A20 20 0 0 1 24 4h0L24 24z" />
      <circle cx="24" cy="24" r="8.5" fill="#fff" />
      <circle cx="24" cy="24" r="6" fill="#4285F4" />
    </svg>
  );
}

function BraveLogo({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#FB542B" />
      <path
        fill="#fff"
        d="M24 12c2.2 0 3.8 1.1 4.6 2.2l2.8-1.4 1.6 1.8-1.2 1.1c.9 1.4 1.4 3.1 1.4 5v7.2c0 4.4-2.6 7.3-7.2 9.2l-2 .8-2-.8c-4.6-1.9-7.2-4.8-7.2-9.2V20.7c0-1.9.5-3.6 1.4-5l-1.2-1.1 1.6-1.8 2.8 1.4C20.2 13.1 21.8 12 24 12zm0 4.2c-1.5 0-2.7.9-3.2 2.1l-.3.8H17.8v6.4c0 3.1 1.7 5.1 5.2 6.6l1 0.4 1-.4c3.5-1.5 5.2-3.5 5.2-6.6v-6.4h-2.7l-.3-.8c-.5-1.2-1.7-2.1-3.2-2.1z"
      />
    </svg>
  );
}

function EdgeLogo({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#0078D4" />
      <path
        fill="#fff"
        d="M34.5 27.2c-.4 5.4-4.8 9.3-10.4 9.3-6.5 0-11.1-4.8-11.1-11.4 0-4.2 2.2-7.7 6.4-9.8-1.3 2.2-1.6 4.1-1.3 5.9.8-3.3 3.6-5.5 8-5.5 5.6 0 9.4 3.7 9.4 9.1 0 .5 0 1-.1 1.4h-14c.3 3.2 2.6 5.5 5.9 5.5 2.2 0 3.9-.9 5-2.4.6.9 1.4 1.6 2.2 2.3z"
      />
      <path fill="#50E6FF" d="M14.2 24.2c.2-4.2 3.1-8.1 8.8-9.5-4.8 1.6-7.4 5.1-7.4 9.7 0 .8.1 1.6.2 2.3-.9-.7-1.5-1.6-1.6-2.5z" />
    </svg>
  );
}

function AppleLogo({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="#111">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function WindowsLogo({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="#0078D4">
      <path d="M3 5.5 10.5 4.4v7.1H3zm8.2-1.3L21 3v8.5h-9.8zm0 8.2H21V21l-9.8-1.4zm-8.2.1h7.5v7.3L3 18.7z" />
    </svg>
  );
}

function LinuxLogo({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="#111">
      <path d="M12.504 0c-.155 0-.315.01-.48.032-4.126.538-4.152 5.59-4.15 5.687l-.002.054.002.042c0 .94-.359 2.4-1.036 3.55-.656 1.112-1.41 1.632-1.59 1.75-.082.054-.13.143-.13.24 0 .11.058.21.148.266.04.025 1.02.618 1.02 2.55 0 1.29-.666 2.74-1.4 4.03-.734 1.29-1.51 2.35-1.51 3.28 0 .85.34 1.43.92 1.82.58.39 1.36.59 2.2.59.7 0 1.41-.14 2.06-.41.66-.27 1.26-.68 1.74-1.18.48.5 1.08.91 1.74 1.18.65.27 1.36.41 2.06.41.84 0 1.62-.2 2.2-.59.58-.39.92-.97.92-1.82 0-.93-.776-1.99-1.51-3.28-.734-1.29-1.4-2.74-1.4-4.03 0-1.932.98-2.525 1.02-2.55a.31.31 0 0 0 .148-.266c0-.097-.048-.186-.13-.24-.18-.118-.934-.638-1.59-1.75-.677-1.15-1.036-2.61-1.036-3.55l.002-.042-.002-.054c.002-.097-.024-5.149-4.15-5.687A4.2 4.2 0 0 0 12.504 0z" />
    </svg>
  );
}

function AppStoreLogo({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect width="48" height="48" rx="11" fill="#007AFF" />
      <path fill="#fff" d="M24 11.5 19.2 24h3.1l.9-2.4h5.6l.9 2.4h3.1L28 11.5zm0 4.2 1.6 4.2h-3.2zm-8.4 11.3 3.2-5.5 2.7 4.7H14.8l.8 1.4h13.6l.8-1.4H18.8l2.7-4.7 3.2 5.5h-8.9z" />
    </svg>
  );
}

function PlayLogo({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#EA4335" d="M7 6.5v35l22-17.5z" />
      <path fill="#FBBC05" d="M29 24 41 15 7 6.5z" />
      <path fill="#34A853" d="M29 24 7 41.5 41 33z" />
      <path fill="#4285F4" d="M41 15 29 24l12 9z" />
    </svg>
  );
}

function PuzzleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M8 4h3v2a2 2 0 1 0 4 0V4h3v5h2a2 2 0 1 1 0 4h-2v5H8v-3a2 2 0 1 0-4 0v3H3V4h5z" />
    </svg>
  );
}

function MobileIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 17h2" />
    </svg>
  );
}

function DesktopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function SoonTile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex w-[110px] flex-col items-center gap-3 rounded-2xl px-2 py-3 opacity-50 sm:w-[120px]">
      {children}
      <span className="text-[14px] font-medium">{label}</span>
      <span className="rounded-full bg-[#111] px-2.5 py-0.5 text-[10px] font-medium tracking-[0.04em] text-white uppercase">
        Coming soon
      </span>
    </div>
  );
}

export function GetStarted() {
  const [target, setTarget] = useState<DesktopTarget>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function beginDesktop(next: DesktopTarget) {
    setTarget(next);
    setAccepted(false);
    setError("");
  }

  async function confirmDownload() {
    if (!accepted || !target || busy) return;
    setBusy(true);
    setError("");
    const href = DESKTOP[target].href;
    try {
      const probe = await fetch(href, { method: "HEAD", redirect: "manual" });
      if (probe.status === 404) {
        const body = (await fetch(href, { redirect: "manual" }).then((response) => response.json().catch(() => null))) as {
          error?: string;
        } | null;
        setError(body?.error || "Download is unavailable right now.");
        return;
      }
      if (probe.status !== 200 && probe.status !== 302 && probe.status !== 301) {
        setError("Download is unavailable right now.");
        return;
      }
      // Same origin hop: browser follows our API redirect and saves the zip. No GitHub tab.
      const link = document.createElement("a");
      link.href = href;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTarget(null);
      setAccepted(false);
    } catch {
      setError("Download is unavailable right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#3B6FD8] text-[#111]">
      <header className="mx-auto flex max-w-[920px] items-center justify-between px-5 py-5 sm:px-8">
        <a href="/" className="text-[15px] font-bold tracking-[-0.04em] italic text-white">
          KETRA
        </a>
        <div className="flex items-center gap-2">
          <a href="/docs" className="rounded-full bg-white/15 px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-white/25">
            Docs
          </a>
          <a
            href="https://wallet.ketra.network"
            className="rounded-full bg-white px-3.5 py-1.5 text-[12px] font-medium text-black hover:bg-[#f2f2f2]"
          >
            Web wallet
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[920px] px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
        <div className="text-center text-white">
          <h1 className="text-[2.2rem] leading-none font-medium tracking-[-0.04em] sm:text-[2.8rem]">Get started</h1>
          <p className="mx-auto mt-3 max-w-[42ch] text-[15px] leading-6 text-white/80">
            Chrome extension and desktop apps for macOS, Windows, and Linux are ready. Brave, Edge, and mobile are coming soon.
          </p>
        </div>

        <div className="mt-10 space-y-4">
          <section className="rounded-[28px] bg-white px-6 py-7 sm:px-8">
            <div className="flex items-center justify-center gap-2">
              <PuzzleIcon />
              <h2 className="text-[16px] font-semibold tracking-[-0.02em]">Extension</h2>
            </div>
            <div className="mt-8 flex flex-wrap items-start justify-center gap-2 sm:gap-6">
              <a
                href={CHROME_STORE}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex w-[110px] flex-col items-center gap-3 rounded-2xl px-2 py-3 hover:bg-[#f6f6f6] sm:w-[120px]"
              >
                <ChromeLogo />
                <span className="text-[14px] font-medium">Chrome</span>
                <span className="text-[11px] text-[#8a8a8a] group-hover:text-[#555]">Chrome Web Store</span>
              </a>
              <SoonTile label="Brave">
                <BraveLogo />
              </SoonTile>
              <SoonTile label="Edge">
                <EdgeLogo />
              </SoonTile>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-[28px] bg-white px-6 py-7 sm:px-8">
              <div className="flex items-center justify-center gap-2">
                <MobileIcon />
                <h2 className="text-[16px] font-semibold tracking-[-0.02em]">Mobile</h2>
              </div>
              <div className="mt-8 flex flex-wrap items-start justify-center gap-2 sm:gap-6">
                <SoonTile label="App Store">
                  <AppStoreLogo />
                </SoonTile>
                <SoonTile label="Google Play">
                  <PlayLogo />
                </SoonTile>
              </div>
            </section>

            <section className="rounded-[28px] bg-white px-6 py-7 sm:px-8">
              <div className="flex items-center justify-center gap-2">
                <DesktopIcon />
                <h2 className="text-[16px] font-semibold tracking-[-0.02em]">Desktop</h2>
              </div>
              <div className="mt-8 flex flex-wrap items-start justify-center gap-2 sm:gap-4">
                {(Object.keys(DESKTOP) as Array<keyof typeof DESKTOP>).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => beginDesktop(key)}
                    className="flex w-[100px] flex-col items-center gap-3 rounded-2xl px-2 py-3 hover:bg-[#f6f6f6] sm:w-[110px]"
                  >
                    {key === "mac" ? <AppleLogo /> : key === "windows" ? <WindowsLogo /> : <LinuxLogo />}
                    <span className="text-[14px] font-medium">{DESKTOP[key].label}</span>
                    <span className="text-[11px] text-[#8a8a8a]">Download</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>

        <p className="mt-8 text-center text-[13px] text-white/70">
          Desktop installs ask you to accept that Ketra is a wallet.{" "}
          <a href="/terms" className="underline decoration-white/40 underline-offset-2 hover:decoration-white">
            Terms of Service
          </a>
        </p>
      </main>

      {target ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)] sm:p-7">
            <p className="text-[12px] font-medium tracking-[0.12em] text-[#a3a3a3] uppercase">Before you install</p>
            <h3 className="mt-2 text-[1.45rem] font-medium tracking-[-0.03em]">Download for {DESKTOP[target].label}</h3>
            <p className="mt-3 text-[14px] leading-6 text-[#5c5c5c]">
              Ketra is a crypto wallet. Installing it lets you create or recover an account, hold assets, and sign spends on macOS, Windows, or Linux. You are responsible for your seed and your keys.
            </p>
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl bg-[#f6f6f6] px-4 py-3">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-1 h-4 w-4 accent-black"
              />
              <span className="text-[13px] leading-5 text-[#3a3a3a]">
                I understand Ketra is a wallet and I accept the{" "}
                <a href="/terms" className="font-medium underline decoration-[#ccc] underline-offset-2 hover:decoration-black">
                  Terms of Service
                </a>
                .
              </span>
            </label>
            {error ? <p className="mt-3 text-[13px] text-[#b4471c]">{error}</p> : null}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setTarget(null);
                  setAccepted(false);
                  setError("");
                }}
                className="flex-1 rounded-full bg-[#ececec] py-3 text-[13px] font-medium hover:bg-[#e4e4e4]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!accepted || busy}
                onClick={() => void confirmDownload()}
                className="flex-1 rounded-full bg-black py-3 text-[13px] font-medium text-white enabled:hover:bg-[#222] disabled:opacity-35"
              >
                {busy ? "Starting…" : "Download"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
