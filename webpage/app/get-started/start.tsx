const RELEASE = "https://github.com/Teckdegen/ketra/releases/download/v0.1.0";

const DESKTOP = {
  windows: {
    label: "Windows",
    href: `${RELEASE}/Ketra-Setup.exe`,
    logo: "/logos/platforms/windows.svg",
    note: "Installer · 10+",
  },
  linux: {
    label: "Linux",
    href: `${RELEASE}/Ketra.deb`,
    logo: "/logos/platforms/linux.svg",
    note: "Installer · .deb",
  },
} as const;

type DesktopTarget = keyof typeof DESKTOP;

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
          <a href="/docs" className="rounded-full bg-black px-4 py-2 text-[13px] font-medium text-white hover:bg-[#222]">
            Docs
          </a>
        </nav>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[960px] flex-1 flex-col justify-center px-4 pb-4 pt-4 sm:px-6 sm:pt-5">
        <div className="text-center">
          <h1 className="text-[1.85rem] leading-none font-medium tracking-[-0.04em] text-black sm:text-[2.35rem]">Get started</h1>
          <p className="mx-auto mt-2 max-w-[48ch] text-[13px] leading-5 text-[#8a8a8a] sm:text-[14px]">
            Web wallet plus desktop for Windows 10+ and Linux x64. Chrome, Brave, Edge, macOS, and mobile are coming soon.
          </p>
        </div>

        <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-3.5">
          <section className="rounded-[24px] bg-white px-4 py-4 sm:rounded-[28px] sm:px-6 sm:py-5">
            <h2 className="text-center text-[13px] font-semibold tracking-[-0.02em] text-[#111]">Extension</h2>
            <div className="mt-3 flex flex-wrap items-start justify-center gap-1 sm:mt-4 sm:gap-4">
              <Soon label="Chrome" src="/logos/platforms/chrome.svg" />
              <Soon label="Brave" src="/logos/platforms/brave.png" />
              <Soon label="Edge" src="/logos/platforms/edge.svg" />
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-3 sm:gap-3.5">
            <section className="rounded-[24px] bg-white px-4 py-4 sm:rounded-[28px] sm:px-5 sm:py-5">
              <h2 className="text-center text-[13px] font-semibold tracking-[-0.02em]">Web</h2>
              <div className="mt-3 flex justify-center sm:mt-4">
                <a
                  href="https://wallet.ketra.network"
                  className="flex w-[100px] flex-col items-center gap-1.5 rounded-2xl px-1 py-2 hover:bg-[#f6f6f6]"
                >
                  <Brand src="/logos/platforms/web.svg" alt="Web wallet" />
                  <span className="text-[12px] font-medium sm:text-[13px]">Web wallet</span>
                  <span className="text-[10px] text-[#8a8a8a]">Open</span>
                </a>
              </div>
            </section>

            <section className="rounded-[24px] bg-white px-4 py-4 sm:rounded-[28px] sm:px-5 sm:py-5">
              <h2 className="text-center text-[13px] font-semibold tracking-[-0.02em]">Mobile</h2>
              <div className="mt-3 flex flex-wrap items-start justify-center gap-1 sm:mt-4 sm:gap-3">
                <Soon label="App Store" src="/logos/platforms/appstore.svg" />
                <Soon label="Google Play" src="/logos/platforms/play.svg" />
              </div>
            </section>

            <section className="rounded-[24px] bg-white px-4 py-4 sm:rounded-[28px] sm:px-5 sm:py-5">
              <h2 className="text-center text-[13px] font-semibold tracking-[-0.02em]">Desktop</h2>
              <div className="mt-3 flex flex-wrap items-start justify-center gap-1 sm:mt-4 sm:gap-1">
                <Soon label="macOS" src="/logos/platforms/apple.svg" />
                {(Object.keys(DESKTOP) as DesktopTarget[]).map((key) => (
                  <a
                    key={key}
                    href={DESKTOP[key].href}
                    className="flex w-[80px] flex-col items-center gap-1.5 rounded-2xl px-1 py-2 hover:bg-[#f6f6f6] sm:w-[88px]"
                  >
                    <Brand src={DESKTOP[key].logo} alt={DESKTOP[key].label} />
                    <span className="text-[12px] font-medium sm:text-[13px]">{DESKTOP[key].label}</span>
                    <span className="text-[10px] text-[#8a8a8a]">{DESKTOP[key].note}</span>
                  </a>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
