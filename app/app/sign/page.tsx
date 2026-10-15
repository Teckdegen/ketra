"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Review() {
  const params = useSearchParams();
  const action = params.get("action") || "Spend";
  const amount = params.get("amount");
  const to = params.get("to");
  const asset = params.get("asset");
  const route = params.get("route");
  const rows = [
    ["Action", action],
    ["Chain", "Robinhood ETH"],
    ["Nonce", "0"],
    ["Amount", amount || "None"],
    ["Detail", to || asset || route || "None"],
    ["Route", route || "—"],
  ];

  return (
    <div className="max-w-lg">
      <h1 className="text-[1.7rem] font-medium tracking-[-0.03em]">Sign</h1>
      <p className="mt-2 text-[14px] leading-6 text-[#8a8a8a]">
        This is the exact batch. An ML-DSA-44 signature is what approves it.
      </p>
      <dl className="mt-6 overflow-hidden glass rounded-[28px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-6 border-b border-[#f2f2f2] px-5 py-4 last:border-b-0">
            <dt className="text-[13px] text-[#8a8a8a]">{label}</dt>
            <dd className="max-w-[24ch] text-right text-[14px] break-all">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-[13px] leading-5 text-[#8a8a8a]">
        The gas key can submit this. It cannot change the batch, and it cannot spend.
      </p>
      <button type="button" className="mt-5 rounded-lg bg-black px-4 py-2.5 text-[13px] font-medium text-white">
        Sign with ML-DSA-44
      </button>
      <p className="mt-3 text-[12px] leading-5 text-[#a3a3a3]">
        The Robinhood account does not exist yet, so this is not submitted.
      </p>
    </div>
  );
}

export default function Sign() {
  return (
    <Suspense>
      <Review />
    </Suspense>
  );
}
