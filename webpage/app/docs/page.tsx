import type { Metadata } from "next";
import { Docs } from "./docs";

export const metadata: Metadata = {
  title: "Docs · Ketra",
  description: "How Ketra works: smart accounts, MLDSA44 signatures, spends, fees, and Robinhood Chain.",
};

export default function DocPage() {
  return <Docs />;
}
