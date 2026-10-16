"use client";

import { useEffect, useState } from "react";

const sections = [
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

type SectionId = (typeof sections)[number]["id"];

export function Docs() {
  const [active, setActive] = useState<SectionId>("start");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const nodes = sections
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
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.15, 0.4, 0.7] },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  function go(id: SectionId) {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-[#111]">
      <header className="sticky top-0 z-40 border-b border-[#e8e8ea] bg-[#f7f7f8]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <a href="/" className="text-[14px] font-bold tracking-[-0.04em] italic">
              KETRA
            </a>
            <span className="hidden h-4 w-px bg-[#ddd] sm:block" />
            <span className="hidden text-[13px] text-[#6d6d6d] sm:block">Docs</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="rounded-full bg-[#ececec] px-3 py-1.5 text-[12px] font-medium lg:hidden"
            >
              {open ? "Close" : "Menu"}
            </button>
            <a
              href="https://wallet.ketra.network"
              className="rounded-full bg-black px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-[#222]"
            >
              Open wallet
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1180px] lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside
          className={`border-[#e8e8ea] bg-[#f7f7f8] lg:sticky lg:top-14 lg:h-[calc(100vh-56px)] lg:overflow-y-auto lg:border-r ${
            open ? "block border-b px-4 py-4" : "hidden lg:block"
          }`}
        >
          <nav className="lg:px-5 lg:py-8">
            <p className="mb-3 text-[11px] font-medium tracking-[0.12em] text-[#a3a3a3] uppercase">Guide</p>
            <ul className="space-y-0.5">
              {sections.map((section) => (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => go(section.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-[13px] ${
                      active === section.id
                        ? "bg-white font-medium text-black shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                        : "text-[#6d6d6d] hover:bg-white/70 hover:text-black"
                    }`}
                  >
                    {section.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="min-w-0 px-4 py-10 sm:px-8 sm:py-14 lg:px-12">
          <article className="mx-auto max-w-[720px]">
            <p className="text-[12px] font-medium tracking-[0.12em] text-[#a3a3a3] uppercase">Ketra docs</p>
            <h1 className="mt-3 text-[2.2rem] leading-[1.05] font-medium tracking-[-0.04em] sm:text-[2.6rem]">
              How Ketra works
            </h1>
            <p className="mt-4 text-[16px] leading-7 text-[#5c5c5c]">
              Plain language for the tech behind the wallet. No jargon wall. Just how your assets stay safe and how a spend actually moves.
            </p>

            <section id="start" className="doc-section scroll-mt-24 pt-14">
              <h2>Start here</h2>
              <p>
                Ketra is a smart account wallet on Robinhood Chain. Your ETH and tokens sit on a contract that is your account. That contract will not move anything unless an MLDSA44 signature says yes.
              </p>
              <div className="doc-callout">
                <p className="font-medium text-black">The short version</p>
                <p className="mt-2">
                  The account holds the money. Your owner key signs the exact plan. A separate gas key only pays the network fee and submits the plan. The gas key cannot spend.
                </p>
              </div>
            </section>

            <section id="account" className="doc-section scroll-mt-24 pt-14">
              <h2>The account</h2>
              <p>
                When you create a Ketra wallet, the app deploys a contract for you. Balances live at that contract address. There is no admin withdraw. There is no upgrade path. There is no function that treats the transaction sender as the owner.
              </p>
              <ul>
                <li>ETH and tokens sit on the account address.</li>
                <li>Receiving works before or after the account is fully online, because the address can be known early.</li>
                <li>Spending only runs inside one function: execute, and only after the signature checks pass.</li>
              </ul>
            </section>

            <section id="keys" className="doc-section scroll-mt-24 pt-14">
              <h2>Two keys</h2>
              <p>Every spend uses two different roles.</p>
              <div className="doc-table-wrap">
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

            <section id="signature" className="doc-section scroll-mt-24 pt-14">
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
              <p>
                Change one of those pieces and the old signature fails. That is how Ketra stops a replay, a stale plan, or a swapped recipient.
              </p>
              <div className="doc-note">
                <p>
                  Post quantum here means the owner signature. The chain itself, the gas payer, the tokens, and the exchanges you call still use ordinary chain signatures.
                </p>
              </div>
            </section>

            <section id="spend" className="doc-section scroll-mt-24 pt-14">
              <h2>How a spend works</h2>
              <ol>
                <li>You pick an action in the wallet: send, swap, supply, deposit, or withdraw.</li>
                <li>The app builds the exact steps and asks you to sign them with your owner key.</li>
                <li>A relay submits execute with that signature and pays gas.</li>
                <li>The account checks the deadline, the nonce, the value, and that the stored public key blob is still the same.</li>
                <li>It asks the MLDSA44 verifier. Anything other than success reverts before an external call.</li>
                <li>It advances the nonce, then runs the steps in order.</li>
              </ol>
              <p>
                If a step fails, the whole transaction reverts. The nonce stays put. Nothing half finished sticks on the account.
              </p>
            </section>

            <section id="batch" className="doc-section scroll-mt-24 pt-14">
              <h2>Batches and allowlists</h2>
              <p>
                One signature can cover several steps. A later step can use an allowlist change made earlier in the same batch. That is how a swap or a Morpho supply can approve a contract, call it, then clear the approval before the batch ends.
              </p>
              <p>Built in step kinds include:</p>
              <ul>
                <li>Send ETH or a token</li>
                <li>Approve an allowlisted spender</li>
                <li>Call an allowlisted contract</li>
                <li>Uniswap v2 and v3 style swaps</li>
                <li>Add or remove v2 liquidity</li>
                <li>Turn a target on or off in the allowlist</li>
              </ul>
              <p>
                Generic calls do not go to random addresses. The owner must allow the target first. The calldata is still inside the signed steps, so the owner is approving the exact call, not a blank check.
              </p>
            </section>

            <section id="fees" className="doc-section scroll-mt-24 pt-14">
              <h2>Fees</h2>
              <p>Ketra takes a small cut on the asset that moves. Network gas is separate and paid by the gas payer.</p>
              <div className="doc-table-wrap">
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
              <p>Fees go to a fixed recipient set when the account is created. The account cannot change that address later.</p>
            </section>

            <section id="robinhood" className="doc-section scroll-mt-24 pt-14">
              <h2>Robinhood Chain</h2>
              <p>
                Ketra spends on Robinhood Chain, chain id 4663. That is the live network the wallet targets. The app talks to the public RPC and builds batches for the contracts already live there.
              </p>
              <ul>
                <li>Native asset: ETH</li>
                <li>Stable asset wired in product flows: USDG</li>
                <li>Wrapped ETH is used when a route needs it</li>
              </ul>
            </section>

            <section id="defi" className="doc-section scroll-mt-24 pt-14">
              <h2>What you can do</h2>
              <p>
                These flows are built as signed batches. Positions, shares, swap output, and margin credit land back on your Ketra account. Leftover approvals are cleared before the batch ends.
              </p>
              <div className="doc-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>What it means for you</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Swap</td>
                      <td>Trade through Uniswap style routers on Robinhood Chain</td>
                    </tr>
                    <tr>
                      <td>Morpho supply</td>
                      <td>Supply USDG into the wired Morpho market and earn from that market</td>
                    </tr>
                    <tr>
                      <td>Steakhouse vault</td>
                      <td>Deposit USDG into the Steakhouse vault and hold vault shares on the account</td>
                    </tr>
                    <tr>
                      <td>Withdraw</td>
                      <td>Pull supplied or deposited USDG back to the account, then use it as usual</td>
                    </tr>
                    <tr>
                      <td>Lighter margin</td>
                      <td>Post USDG margin. Orders and fills stay inside Lighter</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="doc-note">
                <p>
                  The account has no callback hooks. Routes that need a pool callback, a flash loan, or an EOA Permit2 signature are out of scope. Ketra uses the allowance path that a contract can complete in one batch.
                </p>
              </div>
            </section>

            <section id="create" className="doc-section scroll-mt-24 pt-14">
              <h2>Creating an account</h2>
              <p>Creating a wallet does more than save a seed in the browser.</p>
              <ol>
                <li>The app generates an MLDSA44 key pair in the client.</li>
                <li>It expands the public key into a prepared blob the on chain verifier can read.</li>
                <li>The factory deploys that blob, then deploys your account pointed at it.</li>
                <li>Registration rejects a broken or degenerate public key before the account can spend.</li>
              </ol>
              <p>
                The account address can be predicted from the salt and the blob. You can fund that address early. Spending waits until both the blob and the account exist.
              </p>
            </section>

            <section id="safety" className="doc-section scroll-mt-24 pt-14">
              <h2>Safety notes</h2>
              <ul>
                <li>Keep your seed private. Anyone with the owner key can sign spends.</li>
                <li>The gas payer is not a backup owner. Losing the owner key means losing control of the account.</li>
                <li>A successful verify means the signature matches the stored public key blob. It does not by itself prove how that key was generated.</li>
                <li>The on chain verifier is research grade code that Ketra wires in. Treat that as part of the trust model.</li>
                <li>There is no admin key that can empty an account. There is no upgrade path that can change the rules later.</li>
              </ul>
            </section>

            <section id="research" className="doc-section scroll-mt-24 pt-14 pb-24">
              <h2>Research</h2>
              <p>
                Ketra stands on public work. FIPS 204 standardizes MLDSA. The smallest parameter set is what the wallet signs with. Drafts around Ethereum precompiles and alternate signature registries are still drafts. They explain the direction of the industry. They are not required for Ketra to run today.
              </p>
              <p className="pt-2">
                Want the product surface instead of the internals?{" "}
                <a href="/" className="font-medium text-black underline decoration-[#ccc] underline-offset-4 hover:decoration-black">
                  Back to the site
                </a>
                {" · "}
                <a
                  href="https://wallet.ketra.network"
                  className="font-medium text-black underline decoration-[#ccc] underline-offset-4 hover:decoration-black"
                >
                  Open the wallet
                </a>
              </p>
            </section>
          </article>
        </main>
      </div>
    </div>
  );
}
