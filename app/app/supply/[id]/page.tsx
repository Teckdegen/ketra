import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getMarket, getSteakhouse } from "@/lib/morpho";
import { MarketView } from "../../vault/ui";

export const instant = false;

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-[14px] text-[#8a8a8a]">Loading this market from Morpho.</p>}>
      <MarketPage params={params} />
    </Suspense>
  );
}

async function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [market, vault] = await Promise.all([getMarket(id), getSteakhouse().catch(() => null)]);
  if (!market) notFound();
  return <MarketView market={market} vault={vault} />;
}
