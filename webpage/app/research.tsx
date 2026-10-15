"use client";

import { useRef } from "react";

const stories = [
  {
    name: "NIST",
    image: "/research/nist.jpg",
    alt: "A quiet laboratory table with paper stacks and a desk lamp",
    caption: "In August 2024 NIST published FIPS 204. ML-DSA-44, the signature Ketra verifies, is that standard.",
  },
  {
    name: "Bai, Ducas, Kiltz, Lepoint, Lyubashevsky, Schwabe, Seiler, Stehlé",
    image: "/research/dilithium.jpg",
    alt: "A metal and glass lattice model on a dark lab bench",
    caption: "Their lattice signature is CRYSTALS-Dilithium. FIPS 204 standardizes it as ML-DSA. ML-DSA-44 is the smallest parameter set.",
  },
  {
    name: "Renaud Dubois, Simon Masson",
    image: "/research/account.jpg",
    alt: "A closed steel lockbox on a laboratory table",
    caption: "Their draft asks Ethereum for a precompile that checks an ML-DSA signature. One path follows FIPS 204. Another uses Keccak, which the chain already prices, to spend less gas. It is still a draft.",
  },
  {
    name: "James Kempton",
    image: "/research/single.jpg",
    alt: "Separate sealed envelopes standing apart on a laboratory table",
    caption: "His draft gives Ethereum one registry for signatures other than secp256k1, so a post-quantum signature can identify an account. ML-DSA is specified in a separate draft that plugs into it. It is still a draft.",
  },
  {
    name: "Schemitt, da Silva, Lunardi, Kreutz, Mansilha, Zorzo",
    image: "/research/calldata.jpg",
    alt: "Thick stacks of paper on a laboratory table under a desk lamp",
    caption: "They time ML-DSA against ECDSA on the signature path Bitcoin and Ethereum use. The check can be fast. The keys and signatures take far more room.",
  },
  {
    name: "Massimo, Kampanakis, Turner, Westerbaan",
    image: "/research/pubkey.jpg",
    alt: "A large iron key beside a small coin on a laboratory table",
    caption: "Their standard says how an ML-DSA public key and signature sit in a certificate. ML-DSA-44, ML-DSA-65, and ML-DSA-87 each get an identifier.",
  },
];

export function Research() {
  const scroller = useRef<HTMLDivElement>(null);

  function move(direction: number) {
    const el = scroller.current;
    const card = el?.querySelector("article");
    if (!el || !card) return;
    const gap = 16;
    el.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap), behavior: "smooth" });
  }

  return (
    <section id="research" className="relative z-10 mx-auto max-w-[1180px] scroll-mt-24 px-5 pt-6 pb-28 sm:px-8">
      <p className="text-[11px] font-medium tracking-[0.14em] text-[#a3a3a3] uppercase">Research</p>
      <div className="mt-4 flex items-end justify-between gap-6">
        <div>
          <h2 className="max-w-[14ch] text-[26px] leading-[0.95] font-medium tracking-[-0.04em] text-black sm:text-[32px]">
            The signature stands on public research
          </h2>
        </div>
        <div className="mb-1 flex gap-2">
          <button
            type="button"
            aria-label="Previous"
            onClick={() => move(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ececec] text-lg text-[#333] hover:bg-[#e4e4e4]"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => move(1)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ececec] text-lg text-[#333] hover:bg-[#e4e4e4]"
          >
            ›
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {stories.map((story) => (
          <article key={story.name} className="relative h-[460px] w-[min(540px,82vw)] shrink-0 snap-start overflow-hidden rounded-[28px]">
            <img src={story.image} alt={story.alt} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/35" />
            <p className="absolute top-5 right-5 left-5 max-w-[28ch] text-[15px] leading-tight font-semibold tracking-[-0.03em] text-white">{story.name}</p>
            <p className="absolute right-5 bottom-5 left-5 max-w-[36ch] text-[13px] leading-snug text-white">{story.caption}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
