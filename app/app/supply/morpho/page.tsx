import { redirect } from "next/navigation";
import { BSPY_MARKET_ID } from "@/lib/morpho";

export default function MorphoSupply() {
  redirect(`/supply/${BSPY_MARKET_ID}`);
}
