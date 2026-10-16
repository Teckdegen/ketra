import { ethCall } from "./chain";
import { findRoute } from "./quote";
import { rhjUsdByAddress } from "./rhj-assets";
import { tokenById, USDG_ADDRESS, WETH_ADDRESS, type Token } from "./tokens";

const GECKO = "https://api.geckoterminal.com/api/v2";
const GECKO_NETWORK = "robinhood";
const STEAKHOUSE = "0xBeEff033F34C046626B8D0A041844C5d1A5409dd";
const PRICE_TTL = 60 * 1000;

type Value = { eth: number | null; usd: number | null };

let ethUsdCache: { at: number; price: number | null } | null = null;
const unitCache = new Map<string, { at: number; eth: number | null }>();

function asNumber(amount: bigint, decimals: number) {
  return Number(amount) / 10 ** decimals;
}

/** ETH/USD from GeckoTerminal's Robinhood WETH price. */
export async function ethUsdPrice(): Promise<number | null> {
  if (ethUsdCache && Date.now() - ethUsdCache.at < PRICE_TTL) return ethUsdCache.price;
  try {
    const response = await fetch(`${GECKO}/simple/networks/${GECKO_NETWORK}/token_price/${WETH_ADDRESS}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("gecko");
    const body = (await response.json()) as { data?: { attributes?: { token_prices?: Record<string, string> } } };
    const raw = body.data?.attributes?.token_prices?.[WETH_ADDRESS.toLowerCase()];
    const price = raw ? Number(raw) : NaN;
    ethUsdCache = { at: Date.now(), price: Number.isFinite(price) && price > 0 ? price : null };
  } catch {
    ethUsdCache = { at: Date.now(), price: null };
  }
  return ethUsdCache.price;
}

async function routeEth(pay: Token, amount: bigint): Promise<bigint | null> {
  const eth = tokenById("ETH")!;
  const usdg = tokenById("USDG")!;
  const direct = await findRoute(pay, eth, amount, undefined, { market: true });
  if (direct === "wrap") return amount;
  if (direct) return direct.amountOut;
  if (pay.id === "USDG" || pay.address?.toLowerCase() === USDG_ADDRESS.toLowerCase()) return null;
  const mid = await findRoute(pay, usdg, amount, undefined, { market: true });
  if (!mid || mid === "wrap") return null;
  const out = await findRoute(usdg, eth, mid.amountOut, undefined, { market: true });
  return out && out !== "wrap" ? out.amountOut : null;
}

async function steakAssets(shares: bigint) {
  const data = await ethCall(STEAKHOUSE, `0x07a2d13a${shares.toString(16).padStart(64, "0")}`);
  return data ? BigInt(data.slice(0, 66)) : null;
}

/** How much ETH one whole unit of the token is worth at the best market route (DEX or Pons curve). */
async function ethPerUnit(token: Token): Promise<number | null> {
  const key = token.id.toLowerCase();
  const hit = unitCache.get(key);
  if (hit && Date.now() - hit.at < PRICE_TTL) return hit.eth;
  let eth: number | null = null;
  if (token.id === "ETH" || token.id === "WETH") eth = 1;
  else if (token.address?.toLowerCase() === STEAKHOUSE.toLowerCase()) {
    const one = 10n ** BigInt(token.decimals);
    const assets = await steakAssets(one);
    const usdg = tokenById("USDG");
    if (assets != null && usdg) {
      const out = await routeEth(usdg, assets);
      eth = out == null ? null : asNumber(out, 18);
    }
  } else {
    const one = 10n ** BigInt(token.decimals);
    const out = await routeEth(token, one);
    eth = out == null ? null : asNumber(out, 18);
  }
  unitCache.set(key, { at: Date.now(), eth });
  return eth;
}

/** Value a balance in ETH and USD. USD is ETH × GeckoTerminal's Robinhood ETH price. */
export async function valueOf(token: Token, amount: bigint, ethUsd?: number | null): Promise<Value> {
  if (amount === 0n) return { eth: 0, usd: 0 };
  const rate = await ethPerUnit(token);
  if (rate == null) return { eth: null, usd: null };
  const eth = asNumber(amount, token.decimals) * rate;
  const price = ethUsd === undefined ? await ethUsdPrice() : ethUsd;
  return { eth, usd: price == null ? null : eth * price };
}

export async function valuesOf(entries: { token: Token; amount: bigint }[]): Promise<Map<string, Value>> {
  const [ethUsd, stockUsd] = await Promise.all([ethUsdPrice(), rhjUsdByAddress()]);
  const result = new Map<string, Value>();
  await Promise.all(
    entries.map(async ({ token, amount }) => {
      if (amount === 0n) {
        result.set(token.id, { eth: 0, usd: 0 });
        return;
      }
      const address = token.address?.toLowerCase() ?? (token.id.startsWith("0x") ? token.id.toLowerCase() : null);
      const unitUsd = address ? stockUsd.get(address) : undefined;
      if (unitUsd != null && unitUsd > 0) {
        const usd = asNumber(amount, token.decimals) * unitUsd;
        result.set(token.id, { eth: ethUsd && ethUsd > 0 ? usd / ethUsd : null, usd });
        return;
      }
      result.set(token.id, await valueOf(token, amount, ethUsd));
    }),
  );
  return result;
}
