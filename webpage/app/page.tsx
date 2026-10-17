import { Ledger } from "./ledger";
import { Research } from "./research";

const BUY_KETRA = "https://ponsfamily.com/launchpad/0x7e3d67c36493225805a91fe17a3f6afda65079d8";

const links = [
  { href: "#product", label: "Product" },
  { href: "#authorization", label: "Authorization" },
  { href: "#chains", label: "Chains" },
  { href: "#developers", label: "Developers" },
  { href: "/docs", label: "Docs" },
];

const marks = [
  { name: "Robinhood", src: "/logos/robinhood.svg" },
  { name: "Uniswap", src: "/logos/uniswap.svg" },
  { name: "Morpho", src: "/logos/morpho.png" },
  { name: "Steakhouse", src: "/logos/steakhouse.png" },
  { name: "Lighter", src: "/logos/lighter.png" },
];

export default function Home() {
  return (
    <div className="relative min-h-screen bg-[#f4f4f4] text-[#111]">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[220px] w-full"
        viewBox="0 0 1440 220"
        preserveAspectRatio="xMidYMin meet"
        fill="none"
      >
        <path d="M-160 8C180 150 620 176 900 92C1180 8 1360 70 1620 -20" stroke="#c6c6c6" strokeWidth="2.3" />
        <path d="M-180 36C160 178 600 204 900 118C1200 32 1380 98 1640 6" stroke="#c6c6c6" strokeWidth="2.3" />
        <path d="M980 -30C1120 70 1280 20 1460 90C1580 136 1660 40 1760 110" stroke="#c6c6c6" strokeWidth="2.3" />
        <path className="hero-line-a" pathLength="1000" d="M-160 8C180 150 620 176 900 92C1180 8 1360 70 1620 -20" stroke="#8a8a8a" strokeWidth="2.7" />
        <path className="hero-line-b" pathLength="1000" d="M-180 36C160 178 600 204 900 118C1200 32 1380 98 1640 6" stroke="#8a8a8a" strokeWidth="2.7" />
      </svg>
      <header className="sticky top-0 z-30 flex justify-center bg-transparent px-4 py-4 sm:py-5">
        <nav className="flex max-w-full items-center gap-1 rounded-full bg-[#ececec] py-1.5 pr-1.5 pl-4 sm:gap-2 sm:pl-5">
          <a href="#top" className="mr-2 text-[13px] font-bold tracking-[-0.04em] italic sm:mr-4">
            KETRA
          </a>
          <div className="hidden items-center md:flex">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full px-3 py-2 text-[13px] font-medium text-[#1c1c1c] hover:bg-black/5"
              >
                {link.label}
              </a>
            ))}
          </div>
          <a
            href="/get-started"
            className="ml-2 rounded-full bg-black px-4 py-2 text-[13px] font-medium text-white hover:bg-[#222] sm:px-4 sm:py-2"
          >
            Get started
          </a>
        </nav>
      </header>
      <div className="relative flex min-h-[calc(100vh-88px)] flex-col overflow-hidden">
      <main id="top" className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6">
        <div className="flex flex-1 flex-col items-center justify-center pt-24 pb-8 text-center sm:pt-32">
          <h1 className="text-[2.5rem] leading-[0.95] font-medium tracking-[-0.04em] text-black sm:text-[3.45rem]">
            Quantum Resistant
            <br />
            Wallet
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-6 font-normal text-[#8a8a8a]">
            Ketra is a smart-account wallet. The account holds the assets. Only an ML-DSA-44 signature can move them.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/get-started"
              className="rounded-full bg-black px-4 py-2 text-[13px] font-medium text-white hover:bg-[#222]"
            >
              Get started
            </a>
            <a
              href={BUY_KETRA}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-[#111] bg-transparent px-4 py-2 text-[13px] font-medium text-black hover:bg-black/5"
            >
              Buy Ketra
            </a>
            <a
              href="/docs"
              className="rounded-full bg-[#e6e6e6] px-4 py-2 text-[13px] font-medium text-black hover:bg-[#dedede]"
            >
              Docs
            </a>
          </div>
        </div>

      </main>
      <div className="relative z-10 w-full min-w-0 overflow-hidden pb-12">
        <div className="logo-marquee flex w-max">
          {[0, 1].map((copy) => (
            <ul key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center">
              {Array.from({ length: 8 }, (_, repeat) =>
                marks.map((mark) => (
                  <li key={`${repeat}-${mark.name}`} className="flex shrink-0 items-center gap-1.5 pr-10 text-[#9a9a9a]">
                    <img src={mark.src} alt="" className="h-7 w-auto opacity-70 brightness-0" />
                    <span className="text-[10px] font-medium tracking-[-0.02em] whitespace-nowrap">{mark.name}</span>
                  </li>
                )),
              )}
            </ul>
          ))}
        </div>
      </div>
      </div>

      <section id="product" className="relative z-10 mx-auto max-w-[1180px] scroll-mt-24 px-5 pt-8 pb-12 sm:px-8">
        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          <article id="authorization" className="flex flex-col overflow-hidden rounded-[28px] bg-white px-6 pt-6">
            <h3 className="text-[14px] font-semibold tracking-[-0.01em]">
              The account holds it <span className="text-[#c8c8c8]">›</span>
            </h3>
            <p className="mt-2 max-w-[34ch] text-[13px] leading-[1.45] text-[#8d8d8d]">
              ETH and tokens sit on the Ketra account. The key that pays gas can submit a transaction. It cannot spend.
            </p>
            <div className="relative mt-3 h-[300px]">
              <div
                className="dot-drift absolute inset-x-[-8%] bottom-[-18%] h-[118%]"
                style={{
                  backgroundImage: "radial-gradient(#b5b5b5 1.25px, transparent 1.4px)",
                  backgroundSize: "11px 11px",
                  maskImage: "radial-gradient(circle at 50% 62%, #000 26%, transparent 70%)",
                  WebkitMaskImage: "radial-gradient(circle at 50% 62%, #000 26%, transparent 70%)",
                }}
              />
              <span className="pulse-ring absolute bottom-[38%] left-1/2 h-16 w-16 rounded-full border border-[#111]" />
              <span className="pulse-ring absolute bottom-[38%] left-1/2 h-16 w-16 rounded-full border border-[#111] [animation-delay:1.4s]" />
              <span className="absolute bottom-[34%] left-1/2 z-10 -translate-x-1/2 rounded-md bg-black px-2.5 py-1 text-[12px] font-medium text-white">
                ML-DSA
              </span>
            </div>
          </article>

          <article id="developers" className="flex flex-col overflow-hidden rounded-[28px] bg-white px-6 pt-6">
            <h3 className="text-[14px] font-semibold tracking-[-0.01em]">
              One signed batch <span className="text-[#c8c8c8]">›</span>
            </h3>
            <p className="mt-2 max-w-[36ch] text-[13px] leading-[1.45] text-[#8d8d8d]">
              The signature covers the chain, the account, the nonce, the deadline, and the exact steps. A replay is rejected.
            </p>
            <div className="relative mt-3 h-[300px]">
              <div className="sheet-float absolute top-4 right-8 left-10 flex h-12 items-center rounded-2xl border border-[#f3f3f3] bg-[#fafafa] px-5 text-[11px] font-medium tracking-[0.18em] text-[#d0d0d0]">
                NONCE
              </div>
              <div className="sheet-float absolute top-[58px] right-5 left-6 flex h-[52px] items-center rounded-2xl border border-[#eee] bg-[#fcfcfc] px-5 text-[11px] font-medium tracking-[0.18em] text-[#bdbdbd] [animation-delay:0.4s]">
                DEADLINE
              </div>
              <div className="sheet-float absolute top-[104px] right-1 left-1 flex h-14 items-center rounded-2xl border border-[#ececec] bg-white px-5 text-[12px] font-medium tracking-[0.18em] text-[#a3a3a3] shadow-[0_10px_24px_rgba(0,0,0,0.05)] [animation-delay:0.8s]">
                STEPS
              </div>
              <svg viewBox="0 0 320 120" className="absolute right-3 bottom-3 left-3 h-[108px] w-[calc(100%-24px)]" aria-hidden="true">
                <path className="sig-draw" d="M16 96 C 70 96, 120 64, 168 46 S 250 18, 292 16" fill="none" stroke="#111" strokeWidth="1.6" />
                <circle cx="292" cy="16" r="3.4" fill="#111" />
                <text x="214" y="14" fill="#111" fontSize="13" fontFamily="inherit">
                  ML-DSA
                </text>
              </svg>
            </div>
          </article>

          <article id="chains" className="flex flex-col overflow-hidden rounded-[28px] bg-white px-6 pt-6">
            <h3 className="text-[14px] font-semibold tracking-[-0.01em]">
              Calls inside the batch <span className="text-[#c8c8c8]">›</span>
            </h3>
            <p className="mt-2 max-w-[38ch] text-[13px] leading-[1.45] text-[#8d8d8d]">
              A swap, a Morpho supply, a Steakhouse deposit, or Lighter margin. The approval is cleared before the batch ends.
            </p>
            <div className="relative mt-3 h-[300px]">
              <div className="absolute top-1/2 left-1/2 h-[230px] w-[230px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#eee]" />
              <span className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.08em] text-white">
                KETRA
              </span>
              <div className="orbit-spin absolute top-1/2 left-1/2 h-0 w-0">
                {marks.map((mark, index) => (
                  <span
                    key={mark.name}
                    className="absolute"
                    style={{ transform: `rotate(${index * 72}deg) translateY(-112px)` }}
                  >
                    <span className="absolute -translate-x-1/2 -translate-y-1/2">
                      <span className="orbit-spin-reverse flex h-9 w-9 items-center justify-center rounded-full border border-[#eee] bg-white">
                        <img src={mark.src} alt="" className="h-4 w-auto brightness-0" />
                      </span>
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </article>
        </div>
      </section>

      <Ledger />
      <Research />

      <section id="scale" className="relative z-10 scroll-mt-24 px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-[1180px] items-stretch gap-4 lg:grid-cols-3">
          <article
            className="flex min-h-[520px] flex-col rounded-[28px] bg-[#161616] p-6 text-white"
            style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1px)", backgroundSize: "16px 16px" }}
          >
            <p className="text-[11px] font-medium tracking-[0.14em] uppercase">All crypto</p>
            <p className="mt-6 text-[42px] leading-none font-medium tracking-[-0.04em]">$2.76 trillion</p>
            <p className="mt-4 max-w-[28ch] text-[14px] leading-6 text-white/80">
              These assets still move with ordinary chain signatures.
            </p>
            <svg viewBox="0 0 320 168" className="mt-auto h-[168px] w-full" role="img" aria-label="Share of crypto market cap">
              <line x1="28" y1="18" x2="308" y2="18" stroke="rgba(255,255,255,0.12)" />
              <line x1="28" y1="68" x2="308" y2="68" stroke="rgba(255,255,255,0.12)" />
              <line x1="28" y1="118" x2="308" y2="118" stroke="rgba(255,255,255,0.28)" />
              <text x="0" y="22" fill="rgba(255,255,255,0.45)" fontSize="10">60%</text>
              <text x="0" y="72" fill="rgba(255,255,255,0.45)" fontSize="10">30%</text>
              <text x="4" y="122" fill="rgba(255,255,255,0.45)" fontSize="10">0</text>
              {[
                [59, "59", "BTC", 58],
                [11, "11", "ETH", 112],
                [7, "7", "USDT", 166],
                [3, "3", "USDC", 220],
                [20, "20", "Other", 274],
              ].map(([value, label, name, x]) => {
                const h = (Number(value) / 60) * 100;
                return (
                  <g key={name}>
                    <rect x={Number(x) - 14} y={118 - h} width="28" height={h} rx="3" fill="#f4f4f4" />
                    <text x={x} y={112 - h} textAnchor="middle" fill="#fff" fontSize="10">{label}</text>
                    <text x={x} y="140" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="10">{name}</text>
                  </g>
                );
              })}
            </svg>
          </article>

          <article
            className="flex min-h-[520px] flex-col rounded-[28px] bg-white p-6 text-[#111]"
            style={{ backgroundImage: "radial-gradient(rgba(0,0,0,0.08) 1px, transparent 1px)", backgroundSize: "16px 16px" }}
          >
            <p className="text-[11px] font-medium tracking-[0.14em] uppercase">Robinhood TVL</p>
            <p className="mt-6 text-[42px] leading-none font-medium tracking-[-0.04em]">$1.048 billion</p>
            <svg viewBox="0 0 320 168" className="mt-auto h-[168px] w-full" role="img" aria-label="Robinhood Chain TVL from July to October 2026">
              <line x1="36" y1="24" x2="308" y2="24" stroke="#ececec" />
              <line x1="36" y1="62" x2="308" y2="62" stroke="#ececec" />
              <line x1="36" y1="100" x2="308" y2="100" stroke="#dedede" />
              <text x="0" y="28" fill="#9a9a9a" fontSize="10">$1.0B</text>
              <text x="0" y="66" fill="#9a9a9a" fontSize="10">$0.5B</text>
              <text x="8" y="104" fill="#9a9a9a" fontSize="10">0</text>
              <path d="M70 73 L140 46 L210 23 L280 20 L280 100 L70 100 Z" fill="#111" opacity="0.06" />
              <path d="M70 73 L140 46 L210 23 L280 20" fill="none" stroke="#111" strokeWidth="1.75" />
              {[
                [70, 73, "Jul"],
                [140, 46, "Aug"],
                [210, 23, "Sep"],
              ].map(([x, y, name]) => (
                <g key={name}>
                  <circle cx={x} cy={y} r="3.2" fill="#fff" stroke="#111" strokeWidth="1.5" />
                  <text x={x} y="124" textAnchor="middle" fill="#8a8a8a" fontSize="11">{name}</text>
                </g>
              ))}
              <circle cx="280" cy="20" r="4.5" fill="#111" />
              <rect x="262" y="132" width="36" height="18" rx="4" fill="#111" />
              <text x="280" y="145" textAnchor="middle" fill="#fff" fontSize="11">Oct</text>
            </svg>
          </article>

          <article
            className="flex min-h-[520px] flex-col rounded-[28px] bg-[#e4e4e4] p-6 text-[#111]"
            style={{ backgroundImage: "radial-gradient(rgba(0,0,0,0.1) 1px, transparent 1px)", backgroundSize: "16px 16px" }}
          >
            <p className="text-[11px] font-medium tracking-[0.14em] uppercase">Stablecoins</p>
            <p className="mt-6 text-[42px] leading-none font-medium tracking-[-0.04em]">$303 billion</p>
            <svg viewBox="0 0 320 168" className="mt-auto h-[168px] w-full" role="img" aria-label="Stablecoin supply split">
              <text x="8" y="36" fill="#6d6d6d" fontSize="10">0</text>
              <text x="292" y="36" fill="#6d6d6d" fontSize="10">100%</text>
              <line x1="8" y1="44" x2="312" y2="44" stroke="#c8c8c8" />
              <rect x="8" y="58" width="186" height="36" rx="4" fill="#111" />
              <rect x="194" y="58" width="73" height="36" fill="#6a6a6a" />
              <rect x="267" y="58" width="45" height="36" rx="4" fill="#f7f7f7" />
              <text x="101" y="80" textAnchor="middle" fill="#fff" fontSize="12">61%</text>
              <rect x="8" y="116" width="8" height="8" rx="2" fill="#111" />
              <text x="22" y="124" fill="#111" fontSize="12">USDT 61%</text>
              <rect x="108" y="116" width="8" height="8" rx="2" fill="#6a6a6a" />
              <text x="122" y="124" fill="#111" fontSize="12">USDC 24%</text>
              <rect x="214" y="116" width="8" height="8" rx="2" fill="#f7f7f7" stroke="#c8c8c8" />
              <text x="228" y="124" fill="#6d6d6d" fontSize="12">Other 15%</text>
            </svg>
          </article>
        </div>
      </section>

      <section id="basics" className="relative z-10 mx-auto max-w-[1180px] scroll-mt-24 px-5 pt-4 pb-28 sm:px-8">
        <p className="text-[11px] font-medium tracking-[0.14em] text-[#a3a3a3] uppercase">The spend</p>
        <h2 className="mt-4 max-w-[14ch] text-[26px] leading-[0.95] font-medium tracking-[-0.04em] text-black sm:text-[32px]">
          The signature moves the assets
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <article>
            <div className="relative h-[210px] overflow-hidden rounded-[22px] sm:h-[230px]">
              <img src="/guides/signature.jpg" alt="Pale horizontal streaks of light" className="h-full w-full object-cover" />
              <span className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#d9d9d9]/90 text-[#333]">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <circle cx="6" cy="6" r="4.2" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M9.2 9.2 L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </span>
            </div>
            <h3 className="mt-4 text-[14px] leading-snug font-semibold tracking-[-0.02em]">What the signature covers</h3>
            <p className="mt-2 text-[13px] leading-5 text-[#8a8a8a]">
              The owner signs the chain, the account, the nonce, the deadline, and every step. Change one of those and the old signature fails.
            </p>
            <p className="mt-4 text-[11px] font-medium tracking-[0.14em] text-[#b0b0b0] uppercase">Signature</p>
          </article>
          <article>
            <div className="relative h-[210px] overflow-hidden rounded-[22px] sm:h-[230px]">
              <img src="/guides/payer.jpg" alt="Dark blue streaks of light" className="h-full w-full object-cover" />
              <span className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#d9d9d9]/90 text-[#333]">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M7 2 V12 M2 7 H12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </span>
            </div>
            <h3 className="mt-4 text-[14px] leading-snug font-semibold tracking-[-0.02em]">The gas key is not the owner</h3>
            <p className="mt-2 text-[13px] leading-5 text-[#8a8a8a]">
              Anyone can submit a batch the owner already signed. Paying the fee gets it included. It does not move the assets.
            </p>
            <p className="mt-4 text-[11px] font-medium tracking-[0.14em] text-[#b0b0b0] uppercase">Two keys</p>
          </article>
          <article>
            <div className="relative h-[210px] overflow-hidden rounded-[22px] sm:h-[230px]">
              <img src="/guides/batch.jpg" alt="Green and gold light streaking past trees" className="h-full w-full object-cover" />
              <span className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#d9d9d9]/90 text-[#333]">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M7 4.2 V7.2 L9 8.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
            <h3 className="mt-4 text-[14px] leading-snug font-semibold tracking-[-0.02em]">One batch, then the allowance is gone</h3>
            <p className="mt-2 text-[13px] leading-5 text-[#8a8a8a]">
              A swap, a supply, a vault deposit, or margin. The token approval opened for that call is set back to zero before the batch ends.
            </p>
            <p className="mt-4 text-[11px] font-medium tracking-[0.14em] text-[#b0b0b0] uppercase">Batch</p>
          </article>
        </div>
      </section>

      <footer id="contact" className="relative z-10 mx-auto max-w-[1180px] px-5 pt-4 pb-10 sm:px-8">
        <div className="flex items-center justify-between gap-6 rounded-[28px] bg-white px-6 py-6 sm:px-12 sm:py-10">
          <span className="text-[15px] font-bold tracking-[-0.04em] italic">KETRA</span>
          <div className="flex items-center gap-3">
            <a
              href={BUY_KETRA}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-black px-4 py-2 text-[13px] font-medium text-white hover:bg-[#222]"
            >
              Buy Ketra
            </a>
            <a
              href="https://x.com/ketra_network"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#e4e4e4] text-[#111] hover:bg-[#f4f4f4]"
              aria-label="Ketra on X"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

