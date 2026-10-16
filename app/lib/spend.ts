export type SpendKind = "send" | "swap" | "morpho" | "steakhouse" | "morpho-withdraw" | "steakhouse-withdraw";

export type SpendAsset = { symbol: string; logo: string; amount: string };

export type SpendSummary = {
  kind: SpendKind;
  title: string;
  pay: SpendAsset;
  receive?: SpendAsset & { minimum: string };
  to: { label: string; address?: string };
  fee: { amount: string; symbol: string; rate: string };
  route?: string;
};

export type SpendStep = { action: number; payload: string };

export type PreparedSpend = {
  summary: SpendSummary;
  nonce: string;
  deadline: number;
  steps: SpendStep[];
  message: string;
};

export const stepNames: Record<number, string> = {
  1: "Call",
  2: "Send ETH",
  3: "Send token",
  4: "Approve",
  5: "Swap",
  6: "Swap",
  7: "Add liquidity",
  8: "Remove liquidity",
  9: "Allow contract",
};
