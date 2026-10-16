import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service · Ketra",
  description: "Terms for using and installing the Ketra wallet.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#fdfcf9] text-[#111]">
      <header className="mx-auto flex max-w-[720px] items-center justify-between px-5 py-5 sm:px-8">
        <a href="/" className="text-[14px] font-bold tracking-[-0.04em] italic">
          KETRA
        </a>
        <a href="/get-started" className="rounded-full border border-[#111] px-3.5 py-1.5 text-[12px] font-medium">
          Get started
        </a>
      </header>

      <main className="mx-auto max-w-[720px] px-5 pb-20 pt-8 sm:px-8">
        <p className="text-[12px] font-medium tracking-[0.12em] text-[#a3a3a3] uppercase">Legal</p>
        <h1 className="mt-3 font-[family-name:var(--font-instrument-serif)] text-[2.4rem] leading-[1.1] font-normal tracking-[-0.02em]">
          Terms of Service
        </h1>
        <p className="mt-3 text-[14px] text-[#8a8a8a]">Last updated October 16, 2026</p>

        <div className="mt-10 space-y-8 text-[15px] leading-7 text-[#5c5c5c]">
          <section>
            <h2 className="font-[family-name:var(--font-instrument-serif)] text-[1.35rem] font-normal text-black">1. What Ketra is</h2>
            <p className="mt-2">
              Ketra is a crypto wallet. It lets you create or recover a smart account, hold assets on Robinhood Chain, and authorize spends with an MLDSA44 signature. Installing the Chrome extension or the desktop app for macOS, Windows, or Linux means you are installing wallet software.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-instrument-serif)] text-[1.35rem] font-normal text-black">2. Your keys</h2>
            <p className="mt-2">
              You control your seed and your owner key. Ketra cannot recover them for you. Anyone with your seed can move assets. Keep backups offline and private.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-instrument-serif)] text-[1.35rem] font-normal text-black">3. Installs</h2>
            <p className="mt-2">
              Desktop builds are offered for macOS, Windows, and Linux. By downloading and installing them you confirm you understand Ketra is a wallet and you accept these terms. Brave, Edge, App Store, and Google Play are not available yet. When they ship, the same wallet terms apply.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-instrument-serif)] text-[1.35rem] font-normal text-black">4. No custody</h2>
            <p className="mt-2">
              Ketra does not hold your assets. Assets sit on your account contract. Network fees, protocol fees, and third party protocol risks are yours to review before you sign.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-instrument-serif)] text-[1.35rem] font-normal text-black">5. No warranty</h2>
            <p className="mt-2">
              The software is provided as is. We do not promise uninterrupted service, bug free code, or that a given protocol call will succeed. Use at your own risk.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-instrument-serif)] text-[1.35rem] font-normal text-black">6. Accepting</h2>
            <p className="mt-2">
              Using the web wallet, installing the Chrome extension, or downloading the macOS, Windows, or Linux desktop app means you accept these Terms of Service. If you do not agree, do not install or use Ketra.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
