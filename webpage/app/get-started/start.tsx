"use client";

import { useState } from "react";

const CHROME_STORE =
  process.env.NEXT_PUBLIC_CHROME_STORE_URL || "https://chromewebstore.google.com/detail/ketra";

const DESKTOP = {
  mac: { label: "macOS", href: "/api/download/mac", logo: "/logos/platforms/apple.svg" },
  windows: { label: "Windows", href: "/api/download/windows", logo: "/logos/platforms/windows.svg" },
  linux: { label: "Linux", href: "/api/download/linux", logo: "/logos/platforms/linux.svg" },
} as const;

type DesktopTarget = keyof typeof DESKTOP | null;

function Brand({ src, alt, dimmed = false }: { src: string; alt: string; dimmed?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`h-9 w-9 object-contain sm:h-10 sm:w-10 ${dimmed ? "opacity-45 grayscale" : ""}`}
    />
  );
}

function Soon({ label, src }: { label: string; src: string }) {
  return (
    <div className="flex w-[88px] flex-col items-center gap-1.5 rounded-2xl px-1 py-2 sm:w-[100px]">
      <Brand src={src} alt="" dimmed />
      <span className="text-[12px] font-medium text-[#8a8a8a] sm:text-[13px]">{label}</span>
      <span className="rounded-full bg-[#ececec] px-2 py-0.5 text-[9px] font-medium tracking-[0.06em] text-[#8a8a8a] uppercase">
        Soon
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
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#f4f4f4] text-[#111]">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[160px] w-full"
        viewBox="0 0 1440 220"
        preserveAspectRatio="xMidYMin meet"
        fill="none"
      >
        <path d="M-160 8C180 150 620 176 900 92C1180 8 1360 70 1620 -20" stroke="#c6c6c6" strokeWidth="2.3" />
        <path d="M-180 36C160 178 600 204 900 118C1200 32 1380 98 1640 6" stroke="#c6c6c6" strokeWidth="2.3" />
        <path className="hero-line-a" pathLength="1000" d="M-160 8C180 150 620 176 900 92C1180 8 1360 70 1620 -20" stroke="#8a8a8a" strokeWidth="2.7" />
        <path className="hero-line-b" pathLength="1000" d="M-180 36C160 178 600 204 900 118C1200 32 1380 98 1640 6" stroke="#8a8a8a" strokeWidth="2.7" />
      </svg>

      <header className="relative z-20 flex justify-center px-4 pt-4 sm:pt-5">
        <nav className="flex max-w-full items-center gap-1 rounded-full bg-[#ececec] py-1.5 pr-1.5 pl-4 sm:gap-2 sm:pl-5">
          <a href="/" className="mr-2 text-[13px] font-bold tracking-[-0.04em] italic sm:mr-3">
            KETRA
          </a>
          <a href="/docs" className="rounded-full px-3 py-2 text-[13px] font-medium text-[#1c1c1c] hover:bg-black/5">
            Docs
          </a>
          <a
            href="https://wallet.ketra.network"
            className="ml-1 rounded-full bg-black px-4 py-2 text-[13px] font-medium text-white hover:bg-[#222]"
          >
            Web wallet
          </a>
        </nav>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[920px] flex-1 flex-col justify-center px-4 pb-4 pt-4 sm:px-6 sm:pt-5">
        <div className="text-center">
          <h1 className="text-[1.85rem] leading-none font-medium tracking-[-0.04em] text-black sm:text-[2.35rem]">Get started</h1>
          <p className="mx-auto mt-2 max-w-[46ch] text-[13px] leading-5 text-[#8a8a8a] sm:text-[14px]">
            Chrome and desktop for macOS, Windows, and Linux are ready. Brave, Edge, and mobile are coming soon.
          </p>
        </div>

        <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-3.5">
          <section className="rounded-[24px] bg-white px-4 py-4 sm:rounded-[28px] sm:px-6 sm:py-5">
            <h2 className="text-center text-[13px] font-semibold tracking-[-0.02em] text-[#111]">Extension</h2>
            <div className="mt-3 flex flex-wrap items-start justify-center gap-1 sm:mt-4 sm:gap-4">
              <a
                href={CHROME_STORE}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-[88px] flex-col items-center gap-1.5 rounded-2xl px-1 py-2 hover:bg-[#f6f6f6] sm:w-[100px]"
              >
                <Brand src="/logos/platforms/chrome.svg" alt="Chrome" />
                <span className="text-[12px] font-medium sm:text-[13px]">Chrome</span>
                <span className="text-[10px] text-[#8a8a8a]">Web Store</span>
              </a>
              <Soon label="Brave" src="/logos/platforms/brave.png" />
              <Soon label="Edge" src="/logos/platforms/edge.svg" />
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 sm:gap-3.5">
            <section className="rounded-[24px] bg-white px-4 py-4 sm:rounded-[28px] sm:px-6 sm:py-5">
              <h2 className="text-center text-[13px] font-semibold tracking-[-0.02em]">Mobile</h2>
              <div className="mt-3 flex flex-wrap items-start justify-center gap-1 sm:mt-4 sm:gap-4">
                <Soon label="App Store" src="/logos/platforms/appstore.svg" />
                <Soon label="Google Play" src="/logos/platforms/play.svg" />
              </div>
            </section>

            <section className="rounded-[24px] bg-white px-4 py-4 sm:rounded-[28px] sm:px-6 sm:py-5">
              <h2 className="text-center text-[13px] font-semibold tracking-[-0.02em]">Desktop</h2>
              <div className="mt-3 flex flex-wrap items-start justify-center gap-1 sm:mt-4 sm:gap-2">
                {(Object.keys(DESKTOP) as Array<keyof typeof DESKTOP>).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => beginDesktop(key)}
                    className="flex w-[84px] flex-col items-center gap-1.5 rounded-2xl px-1 py-2 hover:bg-[#f6f6f6] sm:w-[96px]"
                  >
                    <Brand src={DESKTOP[key].logo} alt={DESKTOP[key].label} />
                    <span className="text-[12px] font-medium sm:text-[13px]">{DESKTOP[key].label}</span>
                    <span className="text-[10px] text-[#8a8a8a]">Download</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>

        <p className="mt-3 text-center text-[12px] text-[#9a9a9a] sm:mt-4">
          Desktop installs ask you to accept that Ketra is a wallet.{" "}
          <a href="/terms" className="underline decoration-[#ccc] underline-offset-2 hover:decoration-[#111]">
            Terms of Service
          </a>
        </p>
      </main>

      {target ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:p-7">
            <p className="text-[12px] font-medium tracking-[0.12em] text-[#a3a3a3] uppercase">Before you install</p>
            <h3 className="mt-2 text-[1.35rem] font-medium tracking-[-0.03em]">Download for {DESKTOP[target].label}</h3>
            <p className="mt-3 text-[14px] leading-6 text-[#5c5c5c]">
              Ketra is a crypto wallet. Installing it lets you create or recover an account, hold assets, and sign spends. You are responsible for your seed and your keys.
            </p>
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl bg-[#f4f4f4] px-4 py-3">
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
