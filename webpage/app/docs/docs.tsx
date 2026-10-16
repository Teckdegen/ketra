"use client";

import { useEffect, useState } from "react";

const toc = [
  { id: "start", label: "Start here" },
  { id: "account", label: "The account" },
  { id: "keys", label: "Two keys" },
  { id: "signature", label: "The signature" },
  { id: "spend", label: "How a spend works" },
  { id: "batch", label: "Batches and allowlists" },
  { id: "fees", label: "Fees" },
  { id: "robinhood", label: "Robinhood Chain" },
  { id: "defi", label: "What you can do" },
  { id: "create", label: "Creating an account" },
  { id: "safety", label: "Safety notes" },
  { id: "research", label: "Research" },
] as const;

type SectionId = (typeof toc)[number]["id"];

const nav = [
  {
    title: "Get started",
    icon: "play",
    items: [
      { href: "/docs", label: "Introduction", active: true },
      { href: "/get-started", label: "Install" },
      { href: "/terms", label: "Terms" },
    ],
  },
  {
    title: "Concepts",
    icon: "book",
    items: [
      { href: "#account", label: "The account" },
      { href: "#keys", label: "Two keys" },
      { href: "#signature", label: "The signature" },
      { href: "#spend", label: "How a spend works" },
      { href: "#safety", label: "Trust model" },
    ],
  },
] as const;

function NavIcon({ kind }: { kind: "play" | "book" | "shield" | "x" | "list" }) {
  if (kind === "play") {
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
        <path d="M4 3.5v9l8-4.5z" />
      </svg>
    );
  }
  if (kind === "book") {
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M3 3.5h5.5A2.5 2.5 0 0 1 11 6v7H5.5A2.5 2.5 0 0 0 3 15.5z" />
        <path d="M13 3.5H7.5A2.5 2.5 0 0 0 5 6v7h5.5A2.5 2.5 0 0 1 13 15.5z" />
      </svg>
    );
  }
  if (kind === "shield") {
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M8 2 3.5 4v4.2c0 2.8 1.9 4.8 4.5 5.8 2.6-1 4.5-3 4.5-5.8V4z" />
      </svg>
    );
  }
  if (kind === "x") {
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
        <path d="M3.2 3.2 12.8 12.8M12.8 3.2 3.2 12.8" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M3 4.5h10M3 8h10M3 11.5h7" />
    </svg>
  );
}

export function Docs() {
  const [active, setActive] = useState<SectionId>("start");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const nodes = toc
      .map((section) => document.getElementById(section.id))
      .filter((node): node is HTMLElement => Boolean(node));
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const id = visible[0]?.target.id as SectionId | undefined;
        if (id) setActive(id);
      },
      { rootMargin: "-18% 0px -58% 0px", threshold: [0.12, 0.35, 0.65] },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  function go(id: SectionId) {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function copyPage() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fdfcf9] text-[#111]">
      <header className="sticky top-0 z-40 border-b border-[#ebe7e0] bg-[#fdfcf9]/92 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6">
          <a href="/" className="text-[15px] font-semibold tracking-[-0.03em]">
            Ketra
          </a>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="rounded-full border border-[#ddd8cf] px-3 py-1.5 text-[12px] font-medium xl:hidden"
            >
              {open ? "Close" : "Menu"}
            </button>
            <a
              href="/"
              className="hidden items-center gap-1 rounded-full border border-[#111] px-3.5 py-1.5 text-[12px] font-medium sm:inline-flex"
            >
              Website <span className="text-[#999]">›</span>
            </a>
            <a
              href="/get-started"
              className="rounded-full bg-black px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-[#222]"
            >
              Get started
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1280px] xl:grid-cols-[220px_minmax(0,1fr)_200px]">
        <aside
          className={`border-[#ebe7e0] xl:sticky xl:top-14 xl:h-[calc(100vh-56px)] xl:overflow-y-auto xl:border-r ${
            open ? "block border-b px-4 py-5" : "hidden xl:block"
          }`}
        >
          <nav className="xl:px-5 xl:py-8">
            <ul className="mb-8 space-y-1">
              <li>
                <a href="/docs#safety" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-[#6d6d6d] hover:bg-[#f3f0ea] hover:text-black">
                  <NavIcon kind="shield" />
                  Security
                </a>
              </li>
              <li>
                <a
                  href="https://x.com/ketranetwork"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-[#6d6d6d] hover:bg-[#f3f0ea] hover:text-black"
                >
                  <NavIcon kind="x" />
                  X
                </a>
              </li>
            </ul>

            {nav.map((group) => (
              <div key={group.title} className="mb-7">
                <p className="mb-2 flex items-center gap-2 px-2 text-[12px] font-semibold text-black">
                  <NavIcon kind={group.icon} />
                  {group.title}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const activeItem = "active" in item && item.active;
                    return (
                      <li key={item.label}>
                        <a
                          href={item.href}
                          onClick={() => {
                            if (item.href.startsWith("#")) {
                              go(item.href.slice(1) as SectionId);
                            }
                            setOpen(false);
                          }}
                          className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-[13px] ${
                            activeItem
                              ? "font-semibold text-black"
                              : "text-[#6d6d6d] hover:bg-[#f3f0ea] hover:text-black"
                          }`}
                        >
                          {activeItem ? <span className="text-[#999]">›</span> : <span className="w-2" />}
                          {item.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 px-4 py-10 sm:px-8 sm:py-12 lg:px-12">
          <article className="mx-auto max-w-[680px]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium tracking-[0.14em] text-[#a3a3a3] uppercase">Get started</p>
                <h1 className="mt-3 font-[family-name:var(--font-instrument-serif)] text-[2.6rem] leading-[1.05] font-normal tracking-[-0.02em] sm:text-[3rem]">
                  Introduction
                </h1>
              </div>
              <button
                type="button"
                onClick={() => void copyPage()}
                className="mt-8 flex shrink-0 items-center gap-1.5 rounded-lg border border-[#e5e0d8] bg-white px-2.5 py-1.5 text-[12px] text-[#555] hover:bg-[#f7f4ef]"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                  <rect x="5" y="5" width="8" height="8" rx="1.5" />
                  <path d="M3 10.5V3.5A1.5 1.5 0 0 1 4.5 2H11" />
                </svg>
                {copied ? "Copied" : "Copy page"}
              </button>
            </div>
            <p className="mt-4 text-[17px] leading-7 text-[#3a3a3a]">
              Quantum resistant wallet for Robinhood Chain. Assets sit on a smart account. Only an MLDSA44 signature can move them.
            </p>

            <section id="start" className="docs-prose scroll-mt-24 pt-12">
              <h2>Start here</h2>
              <p>
                Ketra is a smart account wallet. Your ETH and tokens sit on a contract that is your account. That contract will not move anything unless an MLDSA44 signature says yes.
              </p>
              <div className="docs-callout">
                <p className="font-medium text-black">The short version</p>
                <p className="mt-2">
                  The account holds the money. Your owner key signs the exact plan. A separate gas key only pays the network fee and submits the plan. The gas key cannot spend.
                </p>
              </div>
            </section>

            <section id="account" className="docs-prose scroll-mt-24 pt-12">
              <h2>The account</h2>
              <p>
                When you create a Ketra wallet, the app deploys a contract for you. Balances live at that contract address. There is no admin withdraw. There is no upgrade path. There is no function that treats the transaction sender as the owner.
              </p>
              <ul>
                <li>ETH and tokens sit on the account address.</li>
                <li>Receiving works before or after the account is fully online, because the address can be known early.</li>
                <li>Spending only runs inside execute, and only after the signature checks pass.</li>
              </ul>
            </section>

            <section id="keys" className="docs-prose scroll-mt-24 pt-12">
              <h2>Two keys</h2>
              <p>Every spend uses two different roles.</p>
              <div className="docs-table">
                <table>
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>What it does</th>
                      <th>What it cannot do</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Owner</td>
                      <td>Signs the batch with MLDSA44</td>
                      <td>Does not need to pay gas</td>
                    </tr>
                    <tr>
                      <td>Gas payer</td>
                      <td>Submits the signed batch and pays the network fee</td>
                      <td>Cannot move assets without a valid owner signature</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                Anyone who has a valid owner signature may submit it. Submitting it does not make them the owner. A forged gas payer signature can get a transaction included. It still cannot move what the account holds.
              </p>
            </section>

            <section id="signature" className="docs-prose scroll-mt-24 pt-12">
              <h2>The signature</h2>
              <p>
                Ketra verifies MLDSA44, the FIPS 204 parameter set. NIST published that standard in August 2024. Signing happens in the wallet. Checking happens on chain inside the Ketra verifier.
              </p>
              <p>The signed message binds all of this at once:</p>
              <ul>
                <li>The protocol domain and version</li>
                <li>The chain id</li>
                <li>This account address</li>
                <li>The nonce</li>
                <li>The deadline</li>
                <li>Any ETH that must arrive with the call</li>
                <li>Every step in the batch</li>
              </ul>
              <p>Change one of those pieces and the old signature fails. That is how Ketra stops a replay, a stale plan, or a swapped recipient.</p>
              <div className="docs-note">
                <p>
                  Post quantum here means the owner signature. The chain itself, the gas payer, the tokens, and the exchanges you call still use ordinary chain signatures.
                </p>
              </div>
            </section>

            <section id="spend" className="docs-prose scroll-mt-24 pt-12">
              <h2>How a spend works</h2>
              <ol>
                <li>You pick an action in the wallet: send, swap, supply, deposit, or withdraw.</li>
                <li>The app builds the exact steps and asks you to sign them with your owner key.</li>
                <li>A relay submits execute with that signature and pays gas.</li>
                <li>The account checks the deadline, the nonce, the value, and that the stored public key blob is still the same.</li>
                <li>It asks the MLDSA44 verifier. Anything other than success reverts before an external call.</li>
                <li>It advances the nonce, then runs the steps in order.</li>
              </ol>
              <p>If a step fails, the whole transaction reverts. The nonce stays put. Nothing half finished sticks on the account.</p>
            </section>

            <section id="batch" className="docs-prose scroll-mt-24 pt-12">
              <h2>Batches and allowlists</h2>
              <p>
                One signature can cover several steps. A later step can use an allowlist change made earlier in the same batch. That is how a swap or a Morpho supply can approve a contract, call it, then clear the approval before the batch ends.
              </p>
              <ul>
                <li>Send ETH or a token</li>
                <li>Approve an allowlisted spender</li>
                <li>Call an allowlisted contract</li>
                <li>Uniswap style swaps and liquidity</li>
                <li>Turn a target on or off in the allowlist</li>
              </ul>
            </section>

            <section id="fees" className="docs-prose scroll-mt-24 pt-12">
              <h2>Fees</h2>
              <p>Ketra takes a small cut on the asset that moves. Network gas is separate and paid by the gas payer.</p>
              <div className="docs-table">
                <table>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Protocol fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Send ETH or a token</td>
                      <td>0.1%</td>
                    </tr>
                    <tr>
                      <td>Swap, supply, deposit, withdraw, and other DeFi style calls</td>
                      <td>0.5%</td>
                    </tr>
                    <tr>
                      <td>Approvals and allowlist edits</td>
                      <td>Free</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section id="robinhood" className="docs-prose scroll-mt-24 pt-12">
              <h2>Robinhood Chain</h2>
              <p>
                Ketra spends on Robinhood Chain, chain id 4663. That is the live network the wallet targets. Native asset is ETH. Product flows also wire USDG.
              </p>
            </section>

            <section id="defi" className="docs-prose scroll-mt-24 pt-12">
              <h2>What you can do</h2>
              <ul>
                <li>Swap through Uniswap style routers</li>
                <li>Supply USDG on Morpho</li>
                <li>Deposit into the Steakhouse USDG vault</li>
                <li>Withdraw supplied or deposited USDG</li>
                <li>Post USDG margin on Lighter</li>
              </ul>
            </section>

            <section id="create" className="docs-prose scroll-mt-24 pt-12">
              <h2>Creating an account</h2>
              <ol>
                <li>The app generates an MLDSA44 key pair in the client.</li>
                <li>It expands the public key into a prepared blob the on chain verifier can read.</li>
                <li>The factory deploys that blob, then deploys your account pointed at it.</li>
                <li>Registration rejects a broken or degenerate public key before the account can spend.</li>
              </ol>
            </section>

            <section id="safety" className="docs-prose scroll-mt-24 pt-12">
              <h2>Safety notes</h2>
              <ul>
                <li>Keep your seed private. Anyone with the owner key can sign spends.</li>
                <li>The gas payer is not a backup owner.</li>
                <li>A successful verify means the signature matches the stored public key blob.</li>
                <li>There is no admin key that can empty an account, and no upgrade path.</li>
              </ul>
            </section>

            <section id="research" className="docs-prose scroll-mt-24 pt-12 pb-24">
              <h2>Research</h2>
              <p>
                Ketra stands on public work. FIPS 204 standardizes MLDSA. The smallest parameter set is what the wallet signs with. Drafts around Ethereum precompiles are still drafts. They are not required for Ketra to run today.
              </p>
              <p className="pt-2">
                <a href="/get-started" className="font-medium text-black underline decoration-[#d5d0c8] underline-offset-4 hover:decoration-black">
                  Get started
                </a>
                {" · "}
                <a
                  href="https://wallet.ketra.network"
                  className="font-medium text-black underline decoration-[#d5d0c8] underline-offset-4 hover:decoration-black"
                >
                  Open the web wallet
                </a>
              </p>
            </section>
          </article>
        </main>

        <aside className="hidden border-l border-[#ebe7e0] xl:block">
          <div className="sticky top-14 px-5 py-8">
            <p className="mb-3 flex items-center gap-2 text-[12px] font-medium text-[#8a8a8a]">
              <NavIcon kind="list" />
              On this page
            </p>
            <ul className="space-y-1">
              {toc.map((section) => (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => go(section.id)}
                    className={`flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-[12.5px] ${
                      active === section.id ? "font-semibold text-black" : "text-[#7a7a7a] hover:text-black"
                    }`}
                  >
                    {active === section.id ? <span className="text-[#999]">›</span> : <span className="w-2" />}
                    {section.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
