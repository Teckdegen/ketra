import { rhjAsToken } from "./rhj-assets";
import { isAddress, tokenByAddress, tokenById, tokens, type Token } from "./tokens";

export const RPC = process.env.KETRA_RPC || "https://rpc.mainnet.chain.robinhood.com";
const DEXSCREENER = "https://api.dexscreener.com";
const DEX_CHAIN = "robinhood";

type Pair = {
  chainId: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  info?: { imageUrl?: string };
};

type Market = { priceUsd: number | null; image: string | null; liquidity: number };

const infoCache = new Map<string, { at: number; token: Token | null }>();
const marketCache = new Map<string, { at: number; market: Market | null }>();
const INFO_TTL = 30 * 60 * 1000;
const MARKET_TTL = 60 * 1000;
/** Name searches hide copycats, which show large fake liquidity but no trading; pasting a contract still finds any token. */
const MIN_SEARCH_VOLUME = 1000;

export async function ethCall(to: string, data: string) {
  try {
    const response = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const body = (await response.json()) as { result?: string; error?: unknown };
    if (!body.result || body.result === "0x" || body.error) return null;
    return body.result;
  } catch {
    return null;
  }
}

function decodeString(hex: string | null) {
  if (!hex) return null;
  const data = hex.replace(/^0x/, "");
  try {
    if (data.length >= 128) {
      const offset = Number(BigInt(`0x${data.slice(0, 64)}`)) * 2;
      const length = Number(BigInt(`0x${data.slice(offset, offset + 64)}`));
      if (length <= 4096 && offset + 64 + length * 2 <= data.length) {
        return Buffer.from(data.slice(offset + 64, offset + 64 + length * 2), "hex").toString("utf8").replace(/\0/g, "").trim();
      }
    }
    if (data.length === 64) return Buffer.from(data, "hex").toString("utf8").replace(/\0/g, "").trim();
  } catch {}
  return null;
}

/** Prefer a gateway that actually serves Pons launch logos (ipfs.io often 429s). */
function ipfsHttp(cidPath: string) {
  const path = cidPath.replace(/^ipfs\//, "").replace(/^\/+/, "");
  return `https://gateway.pinata.cloud/ipfs/${path}`;
}

function publicUrl(value: string | null) {
  if (!value) return null;
  const url = value.trim();
  if (url.startsWith("ipfs://")) return ipfsHttp(url.slice(7));
  if (/^https?:\/\/[^/]+\/ipfs\//i.test(url)) {
    const path = url.replace(/^https?:\/\/[^/]+\/ipfs\//i, "");
    return ipfsHttp(path);
  }
  if (url.startsWith("ar://")) return `https://arweave.net/${url.slice(5)}`;
  if (/^https:\/\/[^\s"'<>]+$/i.test(url)) return url;
  if (/^http:\/\/[^\s"'<>]+$/i.test(url)) return url.replace(/^http:/i, "https:");
  return null;
}

async function dexPairs(path: string) {
  try {
    const response = await fetch(`${DEXSCREENER}${path}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok) return [];
    const body = (await response.json()) as Pair[] | { pairs?: Pair[] | null };
    const pairs = Array.isArray(body) ? body : (body.pairs ?? []);
    return pairs.filter((pair) => pair.chainId === DEX_CHAIN);
  } catch {
    return [];
  }
}

/** Price and image from the deepest DexScreener pair where the token is the base. */
export async function markets(addresses: string[]) {
  const now = Date.now();
  const result = new Map<string, Market | null>();
  const missing: string[] = [];
  for (const address of new Set(addresses.map((item) => item.toLowerCase()))) {
    const hit = marketCache.get(address);
    if (hit && now - hit.at < MARKET_TTL) result.set(address, hit.market);
    else missing.push(address);
  }
  for (let i = 0; i < missing.length; i += 30) {
    const batch = missing.slice(i, i + 30);
    const pairs = await dexPairs(`/tokens/v1/${DEX_CHAIN}/${batch.join(",")}`);
    for (const address of batch) {
      const own = pairs
        .filter((pair) => pair.baseToken.address.toLowerCase() === address)
        .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
      const best = own[0];
      const image =
        own.find((pair) => pair.info?.imageUrl)?.info?.imageUrl ??
        pairs.find((pair) => {
          const base = pair.baseToken.address.toLowerCase() === address;
          const quote = pair.quoteToken.address.toLowerCase() === address;
          return (base || quote) && pair.info?.imageUrl;
        })?.info?.imageUrl ??
        null;
      const market = best
        ? {
            priceUsd: best.priceUsd ? Number(best.priceUsd) : null,
            image,
            liquidity: best.liquidity?.usd ?? 0,
          }
        : image
          ? { priceUsd: null, image, liquidity: 0 }
          : null;
      marketCache.set(address, { at: now, market });
      result.set(address, market);
    }
  }
  return result;
}

/** ERC-20 metadata. Official Robinhood stocks use rhj/assets; Pons logos are onchain; else DexScreener. */
export async function tokenInfo(address: string): Promise<Token | null> {
  if (!isAddress(address)) return null;
  const key = address.toLowerCase();
  const known = tokenByAddress(key);
  if (known) return known;
  const hit = infoCache.get(key);
  if (hit && Date.now() - hit.at < INFO_TTL) return hit.token;

  const stock = await rhjAsToken(key);
  if (stock) {
    infoCache.set(key, { at: Date.now(), token: stock });
    return stock;
  }

  // Pons V1/V2 tokens expose logo() onchain (ipfs://…). DexScreener has a CDN resize when indexed.
  const [name, symbol, decimals, logo, market] = await Promise.all([
    ethCall(key, "0x06fdde03").then(decodeString),
    ethCall(key, "0x95d89b41").then(decodeString),
    ethCall(key, "0x313ce567"),
    ethCall(key, "0xfb7f21eb").then(decodeString),
    markets([key]),
  ]);
  const places = decimals ? Number(BigInt(decimals.slice(0, 66))) : NaN;
  let token: Token | null = null;
  if (symbol && Number.isInteger(places) && places >= 0 && places <= 36) {
    const onchain = publicUrl(logo);
    const dex = market.get(key)?.image ?? null;
    // DexScreener CDN first (reliable), then onchain logo via Pinata gateway.
    const image = dex || onchain || "";
    token = { id: key, symbol: symbol.slice(0, 16), name: (name || symbol).slice(0, 48), decimals: places, logo: image, address: key };
  }
  infoCache.set(key, { at: Date.now(), token });
  return token;
}

export async function resolveToken(id: string) {
  return tokenById(id) ?? (await tokenInfo(id));
}

const GECKO = "https://api.geckoterminal.com/api/v2";

function geckoAddress(id: string | undefined) {
  if (!id) return null;
  const address = id.includes("_") ? id.slice(id.indexOf("_") + 1) : id;
  return isAddress(address) && !/^0x0{40}$/i.test(address) ? address.toLowerCase() : null;
}

/** Trending base tokens on Robinhood from GeckoTerminal. */
async function geckoTrending(): Promise<string[]> {
  try {
    const response = await fetch(`${GECKO}/networks/robinhood/trending_pools?page=1`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return [];
    const body = (await response.json()) as {
      data?: { relationships?: { base_token?: { data?: { id?: string } } } }[];
    };
    const addresses: string[] = [];
    for (const pool of body.data ?? []) {
      const address = geckoAddress(pool.relationships?.base_token?.data?.id);
      if (address && !addresses.includes(address)) addresses.push(address);
      if (addresses.length >= 20) break;
    }
    return addresses;
  } catch {
    return [];
  }
}

/** Name search on GeckoTerminal pools for Robinhood. */
async function geckoSearch(query: string): Promise<Map<string, number>> {
  const ranked = new Map<string, number>();
  try {
    const response = await fetch(`${GECKO}/search/pools?query=${encodeURIComponent(query)}&network=robinhood`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return ranked;
    const body = (await response.json()) as {
      data?: {
        attributes?: { volume_usd?: { h24?: string }; name?: string };
        relationships?: { base_token?: { data?: { id?: string } }; quote_token?: { data?: { id?: string } } };
      }[];
    };
    for (const pool of body.data ?? []) {
      const volume = Number(pool.attributes?.volume_usd?.h24 ?? 0);
      for (const side of [pool.relationships?.base_token?.data?.id, pool.relationships?.quote_token?.data?.id]) {
        const address = geckoAddress(side);
        if (!address) continue;
        ranked.set(address, (ranked.get(address) ?? 0) + (Number.isFinite(volume) ? volume : 0));
      }
    }
  } catch {}
  return ranked;
}

/**
 * Token search for the swap "receive" picker.
 * Empty query: built-ins + GeckoTerminal trending.
 * Contract: on-chain metadata (works for any CA, including Pons).
 * Name: DexScreener + GeckoTerminal, ranked by 24h volume.
 */
export async function searchTokens(query: string): Promise<Token[]> {
  const needle = query.trim();
  if (!needle) {
    const trending = await geckoTrending();
    const found = (await Promise.all(trending.map(tokenInfo))).filter((token): token is Token => Boolean(token));
    const seen = new Set(tokens.map((token) => token.id));
    return [...tokens, ...found.filter((token) => !seen.has(token.id) && !tokenByAddress(token.id))];
  }
  if (isAddress(needle)) {
    const token = await tokenInfo(needle);
    return token ? [token] : [];
  }
  const lower = needle.toLowerCase();
  const local = tokens.filter((token) => token.symbol.toLowerCase().includes(lower) || token.name.toLowerCase().includes(lower));
  const [pairs, gecko] = await Promise.all([dexPairs(`/latest/dex/search?q=${encodeURIComponent(needle)}`), geckoSearch(needle)]);
  const knownSymbols = new Set(tokens.map((token) => token.symbol.toLowerCase()));
  const ranked = new Map<string, number>(gecko);
  for (const pair of pairs) {
    for (const side of [pair.baseToken, pair.quoteToken]) {
      if (!side.symbol.toLowerCase().includes(lower) && !side.name.toLowerCase().includes(lower)) continue;
      const address = side.address.toLowerCase();
      if (!isAddress(address) || /^0x0{40}$/.test(address)) continue;
      if (knownSymbols.has(side.symbol.toLowerCase()) && !tokenByAddress(address)) continue;
      ranked.set(address, (ranked.get(address) ?? 0) + (pair.volume?.h24 ?? 0));
    }
  }
  const top = [...ranked]
    .sort((a, b) => b[1] - a[1])
    // DexScreener-only hits need real volume (clone filter). GeckoTerminal hits are kept even when quiet.
    .filter(([address, volume]) => gecko.has(address) || volume >= MIN_SEARCH_VOLUME)
    .slice(0, 16)
    .map(([address]) => address);
  const found = (await Promise.all(top.map(tokenInfo))).filter((token): token is Token => Boolean(token));
  const seen = new Set(local.map((token) => token.id));
  return [...local, ...found.filter((token) => !seen.has(token.id) && !tokenByAddress(token.id))];
}
