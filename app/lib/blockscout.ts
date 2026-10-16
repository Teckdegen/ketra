import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getAddress } from "ethers";
import { CHAIN_ID } from "@/lib/server-chain";
import type { Token } from "@/lib/tokens";

const BASE = `https://api.blockscout.com/${CHAIN_ID}/api/v2`;

export type BlockscoutBalance = {
  token: string;
  balance: string;
  symbol: string;
  name: string;
  decimals: number;
  logo: string;
};

export type BlockscoutTransfer = {
  hash: string;
  block: number;
  time: number;
  from: string;
  to: string;
  token: string;
  amount: string;
  symbol: string;
  name: string;
  decimals: number;
  logo: string;
};

function envKey(name: string) {
  if (process.env[name]) return process.env[name]!.trim();
  for (const file of [
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "..", "protocol", ".env"),
  ]) {
    if (!existsSync(file)) continue;
    const line = readFileSync(file, "utf8")
      .split(/\r?\n/)
      .find((row) => row.startsWith(`${name}=`));
    if (line) return line.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return "";
}

/** Blockscout PRO key for Robinhood Chain (4663). Prefer BLOCKSCOUT_API_KEY env. */
export function blockscoutApiKey() {
  return (
    envKey("BLOCKSCOUT_API_KEY") ||
    envKey("KETRA_BLOCKSCOUT_API_KEY") ||
    // Provided for Ketra wallet portfolio + activity on Robinhood Chain.
    "proapi_fUtgAJUhg0526nrB0IQQyKd6bi9Fm47SEvUvKTYzMeflMpKqWPrColXReXesxR6xC_bXgMDS"
  );
}

function qs(params: Record<string, string | undefined>) {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) out.set(key, value);
  }
  return out.toString();
}

async function blockscoutGet<T>(pathname: string, params: Record<string, string | undefined> = {}): Promise<T | null> {
  const key = blockscoutApiKey();
  if (!key) return null;
  try {
    const url = `${BASE}${pathname}?${qs({ ...params, apikey: key })}`;
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(25000) });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function asTokenMeta(token: {
  address_hash?: string;
  address?: string;
  symbol?: string | null;
  name?: string | null;
  decimals?: string | number | null;
  icon_url?: string | null;
}): Token | null {
  const raw = token.address_hash || token.address;
  if (!raw) return null;
  try {
    const address = getAddress(raw).toLowerCase();
    const decimals = Number(token.decimals ?? 18);
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;
    const symbol = (token.symbol || "TOKEN").slice(0, 16);
    return {
      id: address,
      symbol,
      name: (token.name || symbol).slice(0, 48),
      decimals,
      logo: typeof token.icon_url === "string" ? token.icon_url : "",
      address,
    };
  } catch {
    return null;
  }
}

/** All ERC-20 balances Blockscout indexes for an address (non-zero holdings). */
export async function blockscoutTokenBalances(account: string): Promise<BlockscoutBalance[] | null> {
  const body = await blockscoutGet<
    {
      value?: string;
      token?: {
        address_hash?: string;
        address?: string;
        symbol?: string | null;
        name?: string | null;
        decimals?: string | number | null;
        icon_url?: string | null;
        type?: string | null;
      };
    }[]
  >(`/addresses/${getAddress(account)}/token-balances`);
  if (!body || !Array.isArray(body)) return null;

  const out: BlockscoutBalance[] = [];
  for (const row of body) {
    if (row.token?.type && row.token.type !== "ERC-20") continue;
    const meta = asTokenMeta(row.token ?? {});
    if (!meta || row.value == null) continue;
    try {
      if (BigInt(row.value) === 0n) continue;
    } catch {
      continue;
    }
    out.push({
      token: meta.address!,
      balance: row.value,
      symbol: meta.symbol,
      name: meta.name,
      decimals: meta.decimals,
      logo: meta.logo,
    });
  }
  return out;
}

/** Recent ERC-20 transfers involving the address (for receive / send activity). */
export async function blockscoutTokenTransfers(account: string, limit = 50): Promise<BlockscoutTransfer[] | null> {
  const owner = getAddress(account);
  const body = await blockscoutGet<{
    items?: {
      transaction_hash?: string;
      block_number?: number;
      timestamp?: string;
      from?: { hash?: string };
      to?: { hash?: string };
      total?: { value?: string; decimals?: string };
      token?: {
        address_hash?: string;
        address?: string;
        symbol?: string | null;
        name?: string | null;
        decimals?: string | number | null;
        icon_url?: string | null;
        type?: string | null;
      };
      token_type?: string;
    }[];
  }>(`/addresses/${owner}/token-transfers`, { type: "ERC-20"});
  if (!body?.items || !Array.isArray(body.items)) return null;

  const out: BlockscoutTransfer[] = [];
  for (const item of body.items) {
    if (!item.transaction_hash || item.block_number == null) continue;
    const meta = asTokenMeta(item.token ?? {});
    const amount = item.total?.value;
    if (!meta || !amount) continue;
    try {
      if (BigInt(amount) === 0n) continue;
    } catch {
      continue;
    }
    let from: string;
    let to: string;
    try {
      from = getAddress(item.from?.hash ?? "");
      to = getAddress(item.to?.hash ?? "");
    } catch {
      continue;
    }
    const time = item.timestamp ? Math.floor(new Date(item.timestamp).getTime() / 1000) : 0;
    out.push({
      hash: item.transaction_hash,
      block: item.block_number,
      time,
      from,
      to,
      token: meta.address!,
      amount,
      symbol: meta.symbol,
      name: meta.name,
      decimals: meta.decimals,
      logo: meta.logo,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function blockscoutAsToken(row: Pick<BlockscoutBalance, "token" | "symbol" | "name" | "decimals" | "logo">): Token {
  const address = row.token.toLowerCase();
  return {
    id: address,
    symbol: row.symbol,
    name: row.name,
    decimals: row.decimals,
    logo: row.logo,
    address,
  };
}
