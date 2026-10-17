import { formatAmount, parseAmount } from "./amount";
import { ethCall as call, resolveToken } from "./chain";
import { isWrapPair, poolAddress, tokenByAddress, tokenById, WETH_ADDRESS, type Token } from "./tokens";

const V4_QUOTER = "0x8dc178efb8111bb0973dd9d722ebeff267c98f94";
const V3_QUOTER = "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7";
const V2_ROUTER = "0x89e5db8b5aa49aa85ac63f691524311aeb649eba";
/** Pons factories (current launches, docs active, legacy). */
const PONS_FACTORIES = [
  "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",
  "0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB",
  "0x0c37a24F5D23A486FA692d1500881d698B1F77a4",
];
const PONS_HOOK = "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044";
export const NATIVE = "0x0000000000000000000000000000000000000000";

const V4_POOLS = [
  { fee: 100, tick: 1 },
  { fee: 500, tick: 10 },
  { fee: 3000, tick: 60 },
  { fee: 10000, tick: 200 },
];
const V3_FEES = [100, 500, 3000, 10000];
const BPS = 10_000n;

export type Quote = {
  version: "v4" | "v3" | "v2" | "curve" | "multi" | "wrap" | null;
  amountOut: string | null;
};

function word(value: bigint) {
  return BigInt.asUintN(256, value).toString(16).padStart(64, "0");
}

function addr(value: string) {
  return value.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

function readWord(data: string, index: number) {
  const hex = data.replace(/^0x/, "");
  return BigInt(`0x${hex.slice(index * 64, (index + 1) * 64) || "0"}`);
}

function readAddress(data: string, index: number) {
  return `0x${readWord(data, index).toString(16).padStart(40, "0")}`;
}

function same(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

function encodeV4(currency0: string, currency1: string, fee: number, tick: number, hooks: string, zeroForOne: boolean, amount: bigint) {
  return (
    "0xaa9d21cb" +
    [
      word(32n),
      addr(currency0),
      addr(currency1),
      word(BigInt(fee)),
      word(BigInt(tick)),
      addr(hooks),
      word(zeroForOne ? 1n : 0n),
      word(amount),
      word(256n),
      word(0n),
    ].join("")
  );
}

function encodeV3(tokenIn: string, tokenOut: string, amount: bigint, fee: number) {
  return "0xc6a5026a" + [addr(tokenIn), addr(tokenOut), word(amount), word(BigInt(fee)), word(0n)].join("");
}

function encodeV2(amount: bigint, path: string[]) {
  return "0xd06ca61f" + [word(amount), word(64n), word(BigInt(path.length)), ...path.map(addr)].join("");
}

async function best(calls: Promise<bigint | null>[]) {
  const amounts = await Promise.all(calls);
  return amounts.reduce<{ amount: bigint; index: number } | null>((winner, amount, index) => {
    if (amount == null || amount === 0n) return winner;
    if (winner == null || amount > winner.amount) return { amount, index };
    return winner;
  }, null);
}

const DEFI_FEE_BPS = 50n;

export function afterFee(amount: bigint) {
  return amount - (amount * DEFI_FEE_BPS) / 10000n;
}

export function defiFee(amount: bigint) {
  return (amount * DEFI_FEE_BPS) / 10000n;
}

/** Matches measuredNet in protocol/js/robinhood.js: a token sent into a curve pays its fee afterwards from what is left. */
function measuredNet(amount: bigint) {
  return (amount * 10000n) / (10000n + DEFI_FEE_BPS);
}

export { formatAmount, parseAmount };

export type Route = {
  version: "v4" | "v3" | "v2" | "curve" | "multi";
  amountIn: bigint;
  amountOut: bigint;
  /** Pool or curve currencies. The zero address is native ETH, which is not wrapped first. */
  tokenIn: string;
  tokenOut: string;
  fee?: number;
  tick?: number;
  hooks?: string;
  path?: string[];
  curve?: string;
  side?: "buy" | "sell";
  /** Ketra's fee in the pay token. */
  charged: bigint;
  /** Sequential legs when no direct pool exists (e.g. USDG → ETH → Pons curve). */
  hops?: Route[];
};

type Launch = { token: string; curve: string; pairToken: string; poolFee: number; tickSpacing: number; phase: number };

/** The Pons launch record for a token across known factories, or null. */
async function ponsLaunch(token: Token): Promise<Launch | null> {
  if (!token.address || tokenByAddress(token.address)) return null;
  for (const factory of PONS_FACTORIES) {
    const data = await call(factory, "0x3cf28b5a" + addr(token.address));
    if (!data) continue;
    const words = Math.floor((data.length - 2) / 64);
    // Current factory layout: exists flag at word 14.
    if (words >= 15 && readWord(data, 14) === 1n) {
      return {
        token: readAddress(data, 0),
        curve: readAddress(data, 1),
        pairToken: readAddress(data, 4),
        poolFee: Number(readWord(data, 6)),
        tickSpacing: Number(BigInt.asIntN(256, readWord(data, 7))),
        phase: Number(readWord(data, 10)),
      };
    }
  }
  return null;
}

function pairs(token: Token, pairToken: string) {
  return same(pairToken, NATIVE) ? token.id === "ETH" : Boolean(token.address && same(token.address, pairToken));
}

async function curveWords(curve: string, selectors: string[]) {
  const results = await Promise.all(selectors.map((data) => call(curve, data)));
  return results.some((result) => result == null) ? null : (results as string[]);
}

/** The curve's own integer arithmetic from the Pons docs. Fees come off a buy's input and off a sell's output. */
async function quoteCurve(launch: Launch, side: "buy" | "sell", amount: bigint, recipient: string) {
  const amountOut = (input: bigint, reserveIn: bigint, reserveOut: bigint) => (input * reserveOut) / (reserveIn + input);
  if (side === "buy") {
    const words = await curveWords(launch.curve, ["0x0902f1ac", "0x808bcddc", "0x24a9d853", "0xc1bb8901", "0xd7e1ef39" + addr(recipient)]);
    if (!words) return null;
    const [quoteReserve, tokenReserve] = [readWord(words[0], 0), readWord(words[0], 1)];
    const [sellable, feeBps, taxBps] = [readWord(words[1], 0), readWord(words[2], 0), readWord(words[3], 0)];
    let snipeBps = readWord(words[4], 0);
    if (sellable === 0n) return null;
    if (snipeBps > 0n) {
      const maxSnipe = BPS - feeBps - taxBps - 100n;
      if (snipeBps > maxSnipe) snipeBps = maxSnipe;
    }
    const net = amount - (amount * feeBps) / BPS - (amount * taxBps) / BPS - (amount * snipeBps) / BPS;
    const out = amountOut(net, quoteReserve, tokenReserve);
    return out > sellable ? sellable : out;
  }
  const words = await curveWords(launch.curve, ["0xc68360a5", "0x0902f1ac", "0x24a9d853", "0xc1bb8901"]);
  if (!words || readWord(words[0], 0) !== 0n) return null;
  const [quoteReserve, tokenReserve] = [readWord(words[1], 0), readWord(words[1], 1)];
  const gross = amountOut(amount, tokenReserve, quoteReserve);
  return gross - (gross * readWord(words[2], 0)) / BPS - (gross * readWord(words[3], 0)) / BPS;
}

type V4Pool = { currency0: string; currency1: string; fee: number; tick: number; hooks: string; tokenIn: string; tokenOut: string };

function v4Pool(tokenIn: string, tokenOut: string, fee: number, tick: number, hooks: string): V4Pool {
  const [currency0, currency1] = [tokenIn, tokenOut].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
  return { currency0, currency1, fee, tick, hooks, tokenIn, tokenOut };
}

function pickBest(routes: Route[]) {
  return routes.reduce<Route | null>((winner, route) => (winner == null || route.amountOut > winner.amountOut ? route : winner), null);
}

/**
 * Direct single-venue route (v4 / v3 / v2 / curve). No recursive multi-hop.
 */
async function findDirectRoute(
  pay: Token,
  receive: Token,
  amount: bigint,
  account?: string,
  options?: { market?: boolean },
): Promise<Route | "wrap" | null> {
  if (amount === 0n || pay.id === receive.id) return null;
  if (isWrapPair(pay, receive)) return "wrap";
  const market = Boolean(options?.market);
  const quoted = market ? amount : afterFee(amount);
  if (quoted === 0n) return null;

  const tokenIn = poolAddress(pay);
  const tokenOut = poolAddress(receive);
  if (same(tokenIn, tokenOut)) return "wrap";
  const curveIn = market ? amount : pay.id === "ETH" ? quoted : measuredNet(amount);
  const base = { amountIn: amount, tokenIn, tokenOut, charged: market ? 0n : amount - quoted };

  const paths = [[tokenIn, tokenOut]];
  if (!same(tokenIn, WETH_ADDRESS) && !same(tokenOut, WETH_ADDRESS)) paths.push([tokenIn, WETH_ADDRESS, tokenOut]);

  const nativeIn = pay.id === "ETH" ? NATIVE : tokenIn;
  const nativeOut = receive.id === "ETH" ? NATIVE : tokenOut;
  const pools = V4_POOLS.map((pool) => v4Pool(tokenIn, tokenOut, pool.fee, pool.tick, NATIVE));
  if (nativeIn !== tokenIn || nativeOut !== tokenOut) {
    pools.push(...V4_POOLS.map((pool) => v4Pool(nativeIn, nativeOut, pool.fee, pool.tick, NATIVE)));
  }

  const [sold, bought] = await Promise.all([ponsLaunch(pay), ponsLaunch(receive)]);
  const curves: { launch: Launch; side: "buy" | "sell" }[] = [];
  for (const [launch, side, other] of [
    [bought, "buy", pay],
    [sold, "sell", receive],
  ] as const) {
    if (!launch || !pairs(other, launch.pairToken)) continue;
    const pair = same(launch.pairToken, NATIVE) ? NATIVE : launch.pairToken;
    if (launch.phase === 0) curves.push({ launch, side });
    else if (launch.phase === 2) {
      pools.push(
        side === "buy"
          ? v4Pool(pair, launch.token, launch.poolFee, launch.tickSpacing, PONS_HOOK)
          : v4Pool(launch.token, pair, launch.poolFee, launch.tickSpacing, PONS_HOOK),
      );
    }
  }

  const [v4, v3, v2, curve] = await Promise.all([
    best(
      pools.map(async (pool) => {
        const zeroForOne = same(pool.tokenIn, pool.currency0);
        const data = await call(V4_QUOTER, encodeV4(pool.currency0, pool.currency1, pool.fee, pool.tick, pool.hooks, zeroForOne, quoted));
        return data ? readWord(data, 0) : null;
      }),
    ),
    best(
      V3_FEES.map(async (fee) => {
        const data = await call(V3_QUOTER, encodeV3(tokenIn, tokenOut, quoted, fee));
        return data ? readWord(data, 0) : null;
      }),
    ),
    best(
      paths.map(async (path) => {
        const result = await call(V2_ROUTER, encodeV2(quoted, path));
        if (!result) return null;
        const length = Number(readWord(result, 1));
        return readWord(result, 1 + length);
      }),
    ),
    best(curves.map(({ launch, side }) => quoteCurve(launch, side, curveIn, account ?? NATIVE))),
  ]);

  const routes: Route[] = [];
  if (v4) {
    const pool = pools[v4.index]!;
    routes.push({
      ...base,
      version: "v4",
      amountOut: v4.amount,
      tokenIn: pool.tokenIn,
      tokenOut: pool.tokenOut,
      fee: pool.fee,
      tick: pool.tick,
      hooks: pool.hooks,
    });
  }
  if (v3) routes.push({ ...base, version: "v3", amountOut: v3.amount, fee: V3_FEES[v3.index] });
  if (v2) routes.push({ ...base, version: "v2", amountOut: v2.amount, path: paths[v2.index] });
  if (curve) {
    const { launch, side } = curves[curve.index]!;
    const pair = same(launch.pairToken, NATIVE) ? NATIVE : launch.pairToken;
    routes.push({
      ...base,
      version: "curve",
      amountOut: curve.amount,
      tokenIn: side === "buy" ? pair : launch.token,
      tokenOut: side === "buy" ? launch.token : pair,
      curve: launch.curve,
      side,
      charged: amount - curveIn,
    });
  }
  return pickBest(routes);
}

async function pairTokenAsToken(pairToken: string): Promise<Token | null> {
  if (same(pairToken, NATIVE)) return tokenById("ETH")!;
  if (same(pairToken, WETH_ADDRESS)) return tokenById("WETH")!;
  return resolveToken(pairToken);
}

/** Bridge via the launch's quote asset (usually ETH) or WETH when no direct pool exists. */
async function findMultiHop(
  pay: Token,
  receive: Token,
  amount: bigint,
  account?: string,
  options?: { market?: boolean },
): Promise<Route | null> {
  const eth = tokenById("ETH")!;
  const mids: Token[] = [];
  const seen = new Set<string>();
  const addMid = (token: Token | null | undefined) => {
    if (!token || token.id === pay.id || token.id === receive.id) return;
    if (seen.has(token.id)) return;
    seen.add(token.id);
    mids.push(token);
  };

  const [sold, bought] = await Promise.all([ponsLaunch(pay), ponsLaunch(receive)]);
  if (bought && !pairs(pay, bought.pairToken)) addMid(await pairTokenAsToken(bought.pairToken));
  if (sold && !pairs(receive, sold.pairToken)) addMid(await pairTokenAsToken(sold.pairToken));
  // Generic USDG (or any) ↔ meme bridge through ETH when neither side is already ETH/WETH.
  if (pay.id !== "ETH" && pay.id !== "WETH" && receive.id !== "ETH" && receive.id !== "WETH") addMid(eth);

  const composed: Route[] = [];
  for (const mid of mids) {
    const hop1 = await findDirectRoute(pay, mid, amount, account, options);
    if (!hop1 || hop1 === "wrap" || hop1.amountOut === 0n) continue;
    // Second leg also pays Ketra's defi fee on-chain — quote it the same way (not market).
    const hop2 = await findDirectRoute(mid, receive, hop1.amountOut, account, options);
    if (!hop2 || hop2 === "wrap" || hop2.amountOut === 0n) continue;
    composed.push({
      version: "multi",
      amountIn: amount,
      amountOut: hop2.amountOut,
      tokenIn: hop1.tokenIn,
      tokenOut: hop2.tokenOut,
      charged: hop1.charged + hop2.charged,
      hops: [hop1, hop2],
    });
  }
  return pickBest(composed);
}

/**
 * Best output across Uniswap v4, v3 and v2, and Pons launches.
 * When there is no direct pool (e.g. USDG → bonding-curve token), bridges via the pair asset (usually ETH).
 */
export async function findRoute(
  pay: Token,
  receive: Token,
  amount: bigint,
  account?: string,
  options?: { market?: boolean },
): Promise<Route | "wrap" | null> {
  if (amount === 0n || pay.id === receive.id) return null;
  if (isWrapPair(pay, receive)) return "wrap";

  const direct = await findDirectRoute(pay, receive, amount, account, options);
  if (direct === "wrap") return "wrap";

  const multi = await findMultiHop(pay, receive, amount, account, options);
  return pickBest([direct, multi].filter((route): route is Route => Boolean(route)));
}

export async function quoteSwap(payId: string, receiveId: string, amountText: string, account?: string): Promise<Quote> {
  const [pay, receive] = await Promise.all([resolveToken(payId), resolveToken(receiveId)]);
  const amount = pay ? parseAmount(amountText, pay.decimals) : null;
  if (!pay || !receive || amount == null || amount === 0n) return { version: null, amountOut: null };
  const route = await findRoute(pay, receive, amount, account);
  if (route === "wrap") return { version: "wrap", amountOut: formatAmount(amount, receive.decimals) };
  if (!route) return { version: null, amountOut: null };
  return { version: route.version, amountOut: formatAmount(route.amountOut, receive.decimals) };
}
