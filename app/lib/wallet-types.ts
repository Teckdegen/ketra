import type { Token } from "./tokens";

export type WalletAsset = { token: Token; balance: string; usd: number | null };

export type ActivityKind = "send" | "receive" | "swap" | "wrap" | "unwrap" | "supply" | "deposit" | "withdraw" | "borrow" | "liquidity" | "call";

export type ActivityItem = {
  hash: string;
  time: number;
  kind: ActivityKind;
  counterparty: string | null;
  legs: { token: Token; amount: string }[];
};

export type WalletOverview = {
  account: string;
  totalUsd: number | null;
  assets: WalletAsset[];
  activity: ActivityItem[];
  updated: number;
};
