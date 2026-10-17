import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy · Ketra",
  description: "How Ketra handles data in the website, wallet, and Chrome extension.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#f4f4f4] text-[#111]">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <a href="/" className="text-[15px] font-bold tracking-[-0.04em] italic">
          KETRA
        </a>
        <a href="/" className="rounded-full bg-black px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-[#222]">
          Home
        </a>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-20 pt-6">
        <p className="text-[11px] font-medium tracking-[0.14em] text-[#8a8a8a] uppercase">Legal</p>
        <h1 className="mt-2 text-[2rem] font-medium tracking-[-0.04em]">Privacy</h1>
        <p className="mt-3 text-[14px] leading-6 text-[#666]">Last updated: October 17, 2026</p>

        <div className="mt-10 space-y-8 text-[15px] leading-7 text-[#333]">
          <section>
            <h2 className="text-[1.15rem] font-semibold tracking-[-0.02em] text-black">Who we are</h2>
            <p className="mt-2">
              Ketra is a quantum-resistant smart-account wallet for Robinhood Chain. This policy covers the marketing site
              (ketra.network), the web wallet (wallet.ketra.network), the desktop apps, and the Ketra Chrome extension.
            </p>
          </section>

          <section>
            <h2 className="text-[1.15rem] font-semibold tracking-[-0.02em] text-black">What we collect</h2>
            <p className="mt-2">
              Ketra is built so you keep control of your keys. We do not sell user data. We do not run ads against your
              wallet activity.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium text-black">Owner keys and seeds</span> stay on your device. Ketra does not
                receive, store, or recover your seed or ML-DSA-44 owner key.
              </li>
              <li>
                <span className="font-medium text-black">On-chain activity</span> is public on Robinhood Chain. Anyone can
                read balances and transactions from the chain or a public explorer. That is not private data we host.
              </li>
              <li>
                <span className="font-medium text-black">Chrome extension</span> stores only local window size and
                position in Chrome&apos;s storage so your wallet window opens where you left it. That data never leaves
                your browser.
              </li>
              <li>
                <span className="font-medium text-black">Hosting and basic logs</span> for the website and wallet may
                include standard server logs (for example IP address, user agent, and request path) used to keep the
                service up and secure. We do not use those logs to build advertising profiles.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[1.15rem] font-semibold tracking-[-0.02em] text-black">Chrome extension</h2>
            <p className="mt-2">
              The extension&apos;s single purpose is to open the Ketra wallet. It requests only the{" "}
              <code className="rounded bg-[#ececec] px-1.5 py-0.5 text-[13px]">storage</code> permission. It does not
              read your browsing history, does not inject scripts into other sites, and does not collect passwords,
              payment details, or personal messages.
            </p>
            <p className="mt-2">
              Clicking the extension icon opens{" "}
              <a className="font-medium text-black underline decoration-[#ccc] underline-offset-4 hover:decoration-black" href="https://wallet.ketra.network">
                wallet.ketra.network
              </a>{" "}
              in a dedicated window. Wallet signing and balances run in that page on your device and on Robinhood Chain.
            </p>
          </section>

          <section>
            <h2 className="text-[1.15rem] font-semibold tracking-[-0.02em] text-black">What we do not do</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>We do not sell or rent personal data.</li>
              <li>We do not use wallet data for credit scoring or lending decisions.</li>
              <li>We do not transfer user data for purposes unrelated to running Ketra.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[1.15rem] font-semibold tracking-[-0.02em] text-black">Third parties</h2>
            <p className="mt-2">
              The wallet talks to public Robinhood Chain infrastructure (RPC, explorers, and DeFi contracts you choose to
              use). Those networks are independent of Ketra. When you leave Ketra for another site (for example a
              launchpad), that site&apos;s privacy policy applies.
            </p>
          </section>

          <section>
            <h2 className="text-[1.15rem] font-semibold tracking-[-0.02em] text-black">Contact</h2>
            <p className="mt-2">
              Questions about this policy:{" "}
              <a
                className="font-medium text-black underline decoration-[#ccc] underline-offset-4 hover:decoration-black"
                href="https://x.com/ketra_network"
                target="_blank"
                rel="noopener noreferrer"
              >
                x.com/ketra_network
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
