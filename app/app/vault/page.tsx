import { Suspense } from "react";
import { getSteakhouse } from "@/lib/morpho";
import { VaultView } from "./ui";

export const instant = false;

export default function Vault() {
  return (
    <Suspense fallback={<p className="text-[14px] text-[#8a8a8a]">Loading Steakhouse vault.</p>}>
      <VaultPage />
    </Suspense>
  );
}

async function VaultPage() {
  const vault = await getSteakhouse();
  return <VaultView vault={vault} />;
}
