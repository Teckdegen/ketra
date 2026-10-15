import { Suspense } from "react";
import { listMarkets } from "@/lib/morpho";
import { SupplyBoard } from "./board";

export default function Supply() {
  return (
    <Suspense fallback={<p className="text-[14px] text-[#8a8a8a]">Loading markets from Morpho.</p>}>
      <SupplyList />
    </Suspense>
  );
}

async function SupplyList() {
  const rows = await listMarkets();
  return <SupplyBoard rows={rows} />;
}
