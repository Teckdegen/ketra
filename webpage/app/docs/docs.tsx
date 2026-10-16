"use client";

import { useEffect, useState } from "react";

const EXPLORER = "https://robinhoodchain.blockscout.com";

const toc = [
  { id: "start", label: "Start here" },
  { id: "account", label: "The account" },
  { id: "keys", label: "Two keys" },
  { id: "signature", label: "The signature" },
  { id: "spend", label: "How a spend works" },
  { id: "batch", label: "Batches and allowlists" },
  { id: "fees", label: "Fees" },
  { id: "ktr", label: "$KTR" },
  { id: "robinhood", label: "Robinhood Chain" },
  { id: "contracts", label: "Contracts" },
  { id: "defi", label: "What you can do" },
  { id: "create", label: "Creating an account" },
  { id: "install", label: "Installs" },
  { id: "safety", label: "Safety notes" },
  { id: "research", label: "Research" },
] as const;

type SectionId = (typeof toc)[number]["id"];

const nav = [
  {
    title: "Get started",
    icon: "play" as const,
    items: [
      { href: "/docs", label: "Introduction", active: true },
      { href: "/get-started", label: "Install" },
      { href: "#contracts", label: "Contracts" },
    ],
  },
  {
    title: "Concepts",
    icon: "book" as const,
    items: [
      { href: "#account", label: "The account" },
      { href: "#keys", label: "Two keys" },
      { href: "#signature", label: "The signature" },
      { href: "#spend", label: "How a spend works" },
      { href: "#fees", label: "Fees" },
      { href: "#ktr", label: "$KTR" },
      { href: "#safety", label: "Trust model" },
    ],
  },
];

const ketraContracts = [
  { name: "Factory", address: "0x72FEE9b929eCdCd7517888ce3305614B4722808c", note: "CREATE2 deploy of key blobs and accounts" },
  { name: "MLDSA44 verifier", address: "0x91c02D5Ac2F0616cE87D63b5418f8567AE07362a", note: "On chain signature check" },
  { name: "SHAKE helper", address: "0x31cC22Cc0e9Bf60293a04cA69743001bd2A53826", note: "Pinned hash helper for the verifier" },
];

const chainContracts = [
  { name: "WETH", address: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73", note: "Wrapped ETH", logo: "/logos/weth.svg" },
  { name: "USDG", address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", note: "Stable used in supply and swaps", logo: "/logos/usdg.svg" },
  { name: "Uniswap SwapRouter02", address: "0xCaf681a66D020601342297493863E78C959E5cb2", note: "v3 exactInputSingle", logo: "/logos/uniswap.svg" },
  { name: "Uniswap v3 factory", address: "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA", note: "Pool factory", logo: "/logos/uniswap.svg" },
  { name: "Universal Router", address: "0x8876789976dEcBfCbBbe364623C63652db8C0904", note: "v4 swap path", logo: "/logos/uniswap.svg" },
  { name: "Permit2", address: "0x000000000022D473030F116dDEE9F6B43aC78BA3", note: "Allowance path for v4", logo: null },
  { name: "v4 PoolManager", address: "0x8366a39CC670B4001A1121B8F6A443A643e40951", note: "Pool manager", logo: "/logos/uniswap.svg" },
  { name: "Morpho Blue", address: "0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010", note: "USDG / bSPY supply market", logo: "/logos/morpho.png" },
  { name: "bSPY", address: "0xC3ED4a5A7dB4102F4Ed37Af26ef0d3f21e2360c1", note: "Morpho market collateral", logo: "/logos/bspy.png" },
  { name: "Morpho oracle", address: "0xac6E0472981877dcebb1527E417b5CB6133721b3", note: "Market oracle", logo: "/logos/morpho.png" },
  { name: "Morpho IRM", address: "0x2BD3d5965B26B51814AC95127B2b80dD6CcC0fa1", note: "Interest rate model", logo: "/logos/morpho.png" },
  { name: "Steakhouse USDG vault", address: "0xBeEff033F34C046626B8D0A041844C5d1A5409dd", note: "ERC4626 vault", logo: "/logos/steakhouse.png" },
  { name: "Lighter", address: "0x94bAB9693Ba2f6358507eFfcbd372b0660AFfF9d", note: "USDG margin deposit", logo: "/logos/lighter.png" },
  { name: "Pons factory", address: "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e", note: "Launchpad factory", logo: "/logos/pons.png" },
  { name: "Pons meme hook", address: "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044", note: "Meme hook", logo: "/logos/pons.png" },
];

function NavIcon({ kind }: { kind: "play" | "book" | "list" }) {
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
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M3 4.5h10M3 8h10M3 11.5h7" />
    </svg>
  );
}

function Addr({ address }: { address: string }) {
  return (
    <a
      href={`${EXPLORER}/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all font-mono text-[12px] text-[#111] underline decoration-[#d5d0c8] underline-offset-2 hover:decoration-black"
    >
      {address}
    </a>
  );
}

function Mark({ src, label }: { src: string | null; label: string }) {
  if (!src) {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#111] text-[10px] font-medium text-white">
        {label.slice(0, 1)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-6 w-6 rounded-full bg-white object-contain" />
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
                            if (item.href.startsWith("#")) go(item.href.slice(1) as SectionId);
                            setOpen(false);
                          }}
                          className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-[13px] ${
                            activeItem ? "font-semibold text-black" : "text-[#6d6d6d] hover:bg-[#f3f0ea] hover:text-black"
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
          <article className="mx-auto max-w-[720px]">
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
                {copied ? "Copied" : "Copy page"}
              </button>
            </div>
            <p className="mt-4 text-[17px] leading-7 text-[#3a3a3a]">
              Quantum resistant wallet for Robinhood Chain. Assets sit on a smart account. Only an MLDSA44 signature can move them. This page is the full product and protocol guide, including every contract address you can verify on the explorer.
            </p>

            <section id="start" className="docs-prose scroll-mt-24 pt-12">
              <h2>Start here</h2>
              <p>
                Ketra is a smart account wallet. Your ETH and tokens sit on a contract that is your account. That contract will not move anything unless an MLDSA44 signature says yes. The outer transaction sender only pays gas. It is never treated as the owner.
              </p>
              <div className="docs-callout">
                <p className="font-medium text-black">The short version</p>
                <p className="mt-2">
                  The account holds the money. Your owner key signs the exact plan. A separate gas key only pays the network fee and submits the plan. The gas key cannot spend. Approvals opened for a batch are cleared before the batch ends.
                </p>
              </div>
              <p>
                You can use Ketra in the browser at wallet.ketra.network, or through the desktop apps for Windows 10+ and Linux x64. Chrome, Brave, Edge, macOS, App Store, and Google Play are not shipping yet.
              </p>
            </section>

            <section id="account" className="docs-prose scroll-mt-24 pt-12">
              <h2>The account</h2>
              <p>
                When you create a Ketra wallet, the factory deploys a public key blob and then a KetraAccount pointed at that blob. Balances live at the account address. There is no admin withdraw. There is no upgrade path. There is no function that treats msg.sender or an ECDSA recover as ownership.
              </p>
              <ul>
                <li>ETH and ERC20 tokens sit on the account address.</li>
                <li>The account address can be predicted with CREATE2 before deploy, so you can fund it early.</li>
                <li>Spending only runs inside execute, and only after signature, nonce, deadline, and value checks pass.</li>
                <li>Domain string for new accounts is KETRA_V1. Protocol version is 1.</li>
              </ul>
            </section>

            <section id="keys" className="docs-prose scroll-mt-24 pt-12">
              <h2>Two keys</h2>
              <p>Every spend uses two different roles. Mixing them up is the most common mental model error.</p>
              <div className="docs-table">
                <table>
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>Algorithm</th>
                      <th>What it does</th>
                      <th>What it cannot do</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Owner</td>
                      <td>MLDSA44</td>
                      <td>Signs the exact batch</td>
                      <td>Does not need to pay gas</td>
                    </tr>
                    <tr>
                      <td>Gas payer</td>
                      <td>secp256k1</td>
                      <td>Submits execute and pays the network fee</td>
                      <td>Cannot move assets without a valid owner signature</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                Anyone who has a valid owner signature may submit it. Submitting it does not make them the owner. A forged gas payer signature can get a transaction included on the chain. It still cannot move what the account holds.
              </p>
            </section>

            <section id="signature" className="docs-prose scroll-mt-24 pt-12">
              <h2>The signature</h2>
              <p>
                Ketra verifies MLDSA44, the FIPS 204 parameter set. Public key size is 1,312 bytes. Signature size is 2,420 bytes. Signing runs in the client with noble post quantum. Checking runs on chain in the Ketra verifier.
              </p>
              <p>authorizationMessage binds all of this at once:</p>
              <ul>
                <li>Domain KETRA_V1 and protocol version 1</li>
                <li>block.chainid</li>
                <li>This account address</li>
                <li>The current nonce</li>
                <li>The deadline as a unix timestamp</li>
                <li>attachedValue, the ETH that must arrive with execute</li>
                <li>keccak256 of the full steps list</li>
              </ul>
              <p>
                Change one of those pieces and the old signature fails. That is how Ketra stops a replay, a stale plan, a swapped recipient, or a mutated calldata payload. The nonce advances only after a successful execute. If a step fails, the whole transaction reverts and the nonce stays put.
              </p>
              <div className="docs-note">
                <p>
                  Post quantum here means the owner signature. The chain itself, the gas payer, the tokens, and the exchanges you call still use ordinary chain signatures.
                </p>
              </div>
            </section>

            <section id="spend" className="docs-prose scroll-mt-24 pt-12">
              <h2>How a spend works</h2>
              <ol>
                <li>You pick an action in the wallet: send, swap, supply, deposit, withdraw, or margin.</li>
                <li>The app builds the exact steps, including allows, approvals, calls, and approval clears.</li>
                <li>You sign authorizationMessage with the owner key.</li>
                <li>A relay submits execute with that signature and pays gas.</li>
                <li>The account checks deadline, nonce, attached value, and that the stored public key blob is unchanged.</li>
                <li>It asks the MLDSA44 verifier. Anything other than success reverts before an external call.</li>
                <li>It advances the nonce, then runs the steps in order under a reentrancy lock.</li>
              </ol>
              <p>
                Built in action ids cover call, send ETH, send token, approve, Uniswap v2 and v3 style swaps, add or remove v2 liquidity, and allowlist edits. Robinhood product flows such as Morpho, Steakhouse, Uniswap v4, and Lighter are signed call batches on top of those primitives.
              </p>
            </section>

            <section id="batch" className="docs-prose scroll-mt-24 pt-12">
              <h2>Batches and allowlists</h2>
              <p>
                One signature can cover several steps. A later step can use an allowlist change made earlier in the same batch. That is how a swap or a Morpho supply can allow a contract, approve a token, call the protocol, then set the approval back to zero before the batch ends.
              </p>
              <p>
                Generic calls do not go to random addresses. The owner must allow the target first. The calldata is still inside the signed steps, so the owner is approving the exact call, not a blank check. An approval left open at the end of a batch is rejected.
              </p>
            </section>

            <section id="fees" className="docs-prose scroll-mt-24 pt-12">
              <h2>Fees</h2>
              <p>Ketra takes a small cut on the asset that moves. Network gas is separate and paid by the gas payer in ETH.</p>
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
                    <tr>
                      <td>Wrap or unwrap WETH by itself</td>
                      <td>Free</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                Fees go to a recipient fixed when the account is created. The account cannot change that address later.
              </p>
            </section>

            <section id="ktr" className="docs-prose scroll-mt-24 pt-12">
              <h2>$KTR</h2>
              <p>
                $KTR is the stake that runs Ketra&apos;s gas rail. Ketra already separates the owner key, which can move funds, from the gas key, which only pays network fee and submits execute. $KTR is how that gas path gets economic weight.
              </p>
              <ul>
                <li>Relayers and gas payers stake $KTR to submit executes for accounts.</li>
                <li>Accounts that hold or lock $KTR get cheaper or priority relay.</li>
                <li>Unstaked or abusive relay can be cut off or slashed under the rail rules.</li>
              </ul>
              <p>
                Demand comes from using the wallet, not from a blank narrative. Competitors cannot fake that moat without copying the account model and the relay stack. Short form: no stake, no priority execute.
              </p>
              <div className="docs-note">
                <p>
                  $KTR is the product token for the gas rail. It is not a second owner key and it cannot spend from a Ketra account. Network gas on Robinhood Chain remains ETH.
                </p>
              </div>
            </section>

            <section id="robinhood" className="docs-prose scroll-mt-24 pt-12">
              <h2>Robinhood Chain</h2>
              <p>
                Ketra spends on Robinhood Chain mainnet. Chain id is 4663. Public RPC is https://rpc.mainnet.chain.robinhood.com. Explorer is robinhoodchain.blockscout.com. Native asset is ETH. Product flows also wire USDG.
              </p>
              <ul>
                <li>Factory deployment block reference: 90009810</li>
                <li>Wired Morpho market id: 0xb1453a889f92101054ab8095e0cc5e303f8c797f6ece3f688c7a1e1780a134a6</li>
                <li>Morpho LLTV for that market: 62.5%</li>
                <li>Lighter USDG asset index: 3, perps route: 0</li>
              </ul>
            </section>

            <section id="contracts" className="docs-prose scroll-mt-24 pt-12">
              <h2>Contracts</h2>
              <p>
                Verify these on the explorer before you trust a frontend. Ketra protocol contracts first, then the Robinhood integrations the wallet talks to.
              </p>

              <h3 className="mt-8 font-[family-name:var(--font-instrument-serif)] text-[1.35rem] font-normal text-black">Ketra protocol</h3>
              <div className="docs-table mt-3">
                <table>
                  <thead>
                    <tr>
                      <th>Contract</th>
                      <th>Address</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ketraContracts.map((row) => (
                      <tr key={row.address}>
                        <td>{row.name}</td>
                        <td>
                          <Addr address={row.address} />
                        </td>
                        <td>{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="mt-10 font-[family-name:var(--font-instrument-serif)] text-[1.35rem] font-normal text-black">Robinhood integrations</h3>
              <div className="docs-table mt-3">
                <table>
                  <thead>
                    <tr>
                      <th></th>
                      <th>Contract</th>
                      <th>Address</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chainContracts.map((row) => (
                      <tr key={row.address}>
                        <td>
                          <Mark src={row.logo} label={row.name} />
                        </td>
                        <td>{row.name}</td>
                        <td>
                          <Addr address={row.address} />
                        </td>
                        <td>{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4">
                Explorer base:{" "}
                <a
                  href={EXPLORER}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-black underline decoration-[#d5d0c8] underline-offset-4 hover:decoration-black"
                >
                  {EXPLORER}
                </a>
              </p>
            </section>

            <section id="defi" className="docs-prose scroll-mt-24 pt-12">
              <h2>What you can do</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                {[
                  { src: "/logos/uniswap.svg", label: "Uniswap" },
                  { src: "/logos/morpho.png", label: "Morpho" },
                  { src: "/logos/bspy.png", label: "bSPY" },
                  { src: "/logos/steakhouse.png", label: "Steakhouse" },
                  { src: "/logos/lighter.png", label: "Lighter" },
                  { src: "/logos/pons.png", label: "pons" },
                  { src: "/logos/weth.svg", label: "WETH" },
                ].map((item) => (
                  <span key={item.label} className="inline-flex items-center gap-2 rounded-full border border-[#ebe7e0] bg-white px-3 py-1.5 text-[13px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.src} alt="" className="h-5 w-5 object-contain" />
                    {item.label}
                  </span>
                ))}
              </div>
              <ul>
                <li>Send ETH or tokens from the account</li>
                <li>Swap through Uniswap v3 SwapRouter02 and Uniswap v4 Universal Router paths</li>
                <li>Supply USDG on Morpho against bSPY and withdraw that position</li>
                <li>Deposit USDG into the Steakhouse vault and withdraw shares back to assets</li>
                <li>Post USDG margin on Lighter. Orders and fills stay inside Lighter</li>
              </ul>
              <div className="docs-note">
                <p>
                  The account has no callback hooks. Routes that need a pool callback, a flash loan, or an EOA Permit2 signature are out of scope. Ketra uses the allowance path a contract can complete in one batch.
                </p>
              </div>
            </section>

            <section id="create" className="docs-prose scroll-mt-24 pt-12">
              <h2>Creating an account</h2>
              <ol>
                <li>The client generates an MLDSA44 key pair.</li>
                <li>It expands the public key into a 20,545 byte prepared blob the verifier can read with EXTCODECOPY.</li>
                <li>deployKey publishes that blob. Degenerate t1 keys are rejected.</li>
                <li>createAccount deploys KetraAccount pointed at the blob.</li>
                <li>Spending starts only after both contracts exist. Funding the predicted address can happen earlier.</li>
              </ol>
              <p>
                Keep the seed private. Ketra cannot recover it. Losing the owner key means losing control of the account. The gas payer is not a backup owner.
              </p>
            </section>

            <section id="install" className="docs-prose scroll-mt-24 pt-12">
              <h2>Installs</h2>
              <p>Supported surfaces today:</p>
              <div className="docs-table">
                <table>
                  <thead>
                    <tr>
                      <th>Surface</th>
                      <th>Status</th>
                      <th>Requirement</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Web wallet</td>
                      <td>Live</td>
                      <td>Modern browser at wallet.ketra.network</td>
                    </tr>
                    <tr>
                      <td>Windows desktop</td>
                      <td>Live</td>
                      <td>Windows 10 or newer, x64 installer (Ketra)</td>
                    </tr>
                    <tr>
                      <td>Linux desktop</td>
                      <td>Live</td>
                      <td>Ubuntu/Debian x64 .deb installer (Ketra)</td>
                    </tr>
                    <tr>
                      <td>macOS desktop</td>
                      <td>Coming soon</td>
                      <td>Intel and Apple Silicon builds planned</td>
                    </tr>
                    <tr>
                      <td>Chrome / Brave / Edge</td>
                      <td>Coming soon</td>
                      <td></td>
                    </tr>
                    <tr>
                      <td>App Store / Google Play</td>
                      <td>Coming soon</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                Desktop builds open the same Ketra wallet surface inside a native shell. Download Windows and Linux from Get started. The macOS shell is paused until we ship a build that covers Intel and Apple Silicon cleanly.
              </p>
            </section>

            <section id="safety" className="docs-prose scroll-mt-24 pt-12">
              <h2>Safety notes</h2>
              <ul>
                <li>Keep your seed private. Anyone with the owner key can sign spends.</li>
                <li>The gas payer is not a backup owner.</li>
                <li>A successful verify means the signature matches the stored public key blob. It does not by itself prove how that key was generated.</li>
                <li>The on chain verifier is research grade code that Ketra wires in. Treat that as part of the trust model.</li>
                <li>There is no admin key that can empty an account, and no upgrade path that can change the rules later.</li>
                <li>Always cross check contract addresses on the explorer against this page before you sign.</li>
              </ul>
            </section>

            <section id="research" className="docs-prose scroll-mt-24 pt-12 pb-24">
              <h2>Research</h2>
              <p>
                Ketra stands on public work. FIPS 204 standardizes MLDSA. The smallest parameter set is what the wallet signs with. Drafts around Ethereum precompiles and alternate signature registries explain the industry direction. They are not required for Ketra to run on Robinhood Chain today.
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
