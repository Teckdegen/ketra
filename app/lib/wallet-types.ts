import type { Token } from "./tokens";

export type WalletAsset = { token: Token; balance: string; eth: number | null; usd: number | null };

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
  totalEth: number | null;
  totalUsd: number | null;
  ethUsd: number | null;
  assets: WalletAsset[];
  activity: ActivityItem[];
  updated: number;
};
