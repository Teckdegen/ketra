import { getAddress } from "ethers";
import type { Token } from "@/lib/tokens";

const ASSETS_URL = "https://api.robinhood.com/rhj/assets";
const PRICES_URL = "https://api.robinhood.com/rhj/prices";
const CHAIN_ID = 4663;
const ASSETS_TTL = 60 * 60 * 1000;
const PRICES_TTL = 30 * 1000;

export type RhjAsset = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo: string;
};

type AssetsCache = { at: number; byAddress: Map<string, RhjAsset>; list: RhjAsset[] };
type PricesCache = { at: number; usd: Map<string, number> };

let assetsCache: AssetsCache | null = null;
let pricesCache: PricesCache | null = null;
let assetsInflight: Promise<AssetsCache> | null = null;
let pricesInflight: Promise<PricesCache> | null = null;

function cleanName(name: string, symbol: string) {
  const trimmed = name
    .replace(/\uFFFD/g, "")
    .replace(/\s*[·•]\s*Robinhood Token\s*/gi, "")
    .replace(/\s*Robinhood Token\s*/gi, "")
    .trim();
  return (trimmed || symbol).slice(0, 48);
}

async function loadAssets(): Promise<AssetsCache> {
  if (assetsCache && Date.now() - assetsCache.at < ASSETS_TTL) return assetsCache;
  if (assetsInflight) return assetsInflight;
  assetsInflight = (async () => {
    const response = await fetch(ASSETS_URL, { cache: "no-store", signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error("rhj assets");
    const body = (await response.json()) as {
      assets?: {
        tokenSymbol?: string;
        tokenName?: string;
        tokenDecimals?: number;
        logoUrl?: string;
        status?: string;
        deployments?: { contractAddress?: string; chainId?: number }[];
      }[];
    };
    const byAddress = new Map<string, RhjAsset>();
    for (const asset of body.assets ?? []) {
      if (asset.status && asset.status !== "ASSET_STATUS_ACTIVE") continue;
      const symbol = (asset.tokenSymbol || "").trim();
      if (!symbol) continue;
      const decimals = Number(asset.tokenDecimals ?? 18);
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) continue;
      for (const deployment of asset.deployments ?? []) {
        if (deployment.chainId !== CHAIN_ID || !deployment.contractAddress) continue;
        try {
          const address = getAddress(deployment.contractAddress);
          const entry: RhjAsset = {
            address,
            symbol: symbol.slice(0, 16),
            name: cleanName(asset.tokenName || symbol, symbol),
            decimals,
            logo: typeof asset.logoUrl === "string" ? asset.logoUrl : "",
          };
          byAddress.set(address.toLowerCase(), entry);
        } catch {
          /* skip bad address */
        }
      }
    }
    assetsCache = { at: Date.now(), byAddress, list: [...byAddress.values()] };
    return assetsCache;
  })().finally(() => {
    assetsInflight = null;
  });
  try {
    return await assetsInflight;
  } catch {
    if (assetsCache) return assetsCache;
    return { at: Date.now(), byAddress: new Map(), list: [] };
  }
}

async function loadPrices(): Promise<PricesCache> {
  if (pricesCache && Date.now() - pricesCache.at < PRICES_TTL) return pricesCache;
  if (pricesInflight) return pricesInflight;
  pricesInflight = (async () => {
    const response = await fetch(PRICES_URL, { cache: "no-store", signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error("rhj prices");
    const body = (await response.json()) as {
      quotes?: {
        tokenBid?: string;
        tokenAsk?: string;
        bid?: string;
        ask?: string;
        deployments?: { contractAddress?: string; chainId?: number }[];
      }[];
    };
    const usd = new Map<string, number>();
    for (const quote of body.quotes ?? []) {
      const bid = Number(quote.tokenBid || quote.bid);
      const ask = Number(quote.tokenAsk || quote.ask);
      const mid = Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask > 0 ? (bid + ask) / 2 : NaN;
      if (!Number.isFinite(mid) || mid <= 0) continue;
      for (const deployment of quote.deployments ?? []) {
        if (deployment.chainId !== CHAIN_ID || !deployment.contractAddress) continue;
        try {
          usd.set(getAddress(deployment.contractAddress).toLowerCase(), mid);
        } catch {
          /* skip */
        }
      }
    }
    pricesCache = { at: Date.now(), usd };
    return pricesCache;
  })().finally(() => {
    pricesInflight = null;
  });
  try {
    return await pricesInflight;
  } catch {
    if (pricesCache) return pricesCache;
    return { at: Date.now(), usd: new Map() };
  }
}

/** Official Robinhood Chain stock / ETF token contracts from api.robinhood.com/rhj/assets. */
export async function rhjStockTokens(): Promise<RhjAsset[]> {
  return (await loadAssets()).list;
}

export async function rhjStockAddresses(): Promise<string[]> {
  return (await loadAssets()).list.map((asset) => asset.address);
}

export async function rhjAsset(address: string): Promise<RhjAsset | null> {
  try {
    const key = getAddress(address).toLowerCase();
    return (await loadAssets()).byAddress.get(key) ?? null;
  } catch {
    return null;
  }
}

/** Token metadata for wallet / UI (logos from Robinhood CDN). */
export async function rhjAsToken(address: string): Promise<Token | null> {
  const asset = await rhjAsset(address);
  if (!asset) return null;
  return {
    id: asset.address.toLowerCase(),
    symbol: asset.symbol,
    name: asset.name,
    decimals: asset.decimals,
    logo: asset.logo,
    address: asset.address.toLowerCase(),
  };
}

/** USD mid price per whole token unit from api.robinhood.com/rhj/prices. */
export async function rhjUsdByAddress(): Promise<Map<string, number>> {
  return (await loadPrices()).usd;
}
