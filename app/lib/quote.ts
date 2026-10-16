import { formatAmount, parseAmount } from "./amount";
import { resolveToken } from "./chain";
import { isWrapPair, poolAddress, WETH_ADDRESS, type Token } from "./tokens";

const RPC = "https://rpc.mainnet.chain.robinhood.com";
const V4_QUOTER = "0x8dc178efb8111bb0973dd9d722ebeff267c98f94";
const V3_QUOTER = "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7";
const V2_ROUTER = "0x89e5db8b5aa49aa85ac63f691524311aeb649eba";

const V4_POOLS = [
  { fee: 100, tick: 1 },
  { fee: 500, tick: 10 },
  { fee: 3000, tick: 60 },
  { fee: 10000, tick: 200 },
];
const V3_FEES = [100, 500, 3000, 10000];

export type Quote = {
  version: "v4" | "v3" | "v2" | "wrap" | null;
  amountOut: string | null;
};

function word(value: bigint) {
  return value.toString(16).padStart(64, "0");
}

function addr(value: string) {
  return value.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

function readWord(data: string, index: number) {
  const hex = data.replace(/^0x/, "");
  return BigInt(`0x${hex.slice(index * 64, (index + 1) * 64) || "0"}`);
}

async function call(to: string, data: string) {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
    cache: "no-store",
  });
  const body = (await response.json()) as { result?: string; error?: { message?: string } };
  if (!body.result || body.result === "0x" || body.error) return null;
  return body.result;
}

function encodeV4(currency0: string, currency1: string, fee: number, tick: number, zeroForOne: boolean, amount: bigint) {
  return (
    "0xaa9d21cb" +
    [
      word(32n),
      addr(currency0),
      addr(currency1),
      word(BigInt(fee)),
      word(BigInt(tick)),
      addr("0x0000000000000000000000000000000000000000"),
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

export { formatAmount, parseAmount };

export type Route = {
  version: "v4" | "v3" | "v2";
  amountIn: bigint;
  amountOut: bigint;
  tokenIn: string;
  tokenOut: string;
  fee?: number;
  tick?: number;
  path?: string[];
};

export async function findRoute(pay: Token, receive: Token, amount: bigint): Promise<Route | "wrap" | null> {
  if (amount === 0n || pay.id === receive.id) return null;
  if (isWrapPair(pay, receive)) return "wrap";
  const quoted = afterFee(amount);
  if (quoted === 0n) return null;

  const tokenIn = poolAddress(pay);
  const tokenOut = poolAddress(receive);
  if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) return "wrap";

  const [currency0, currency1] = [tokenIn, tokenOut].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
  const zeroForOne = tokenIn.toLowerCase() === currency0.toLowerCase();
  const base = { amountIn: amount, tokenIn, tokenOut };

  const paths = [[tokenIn, tokenOut]];
  if (tokenIn.toLowerCase() !== WETH_ADDRESS.toLowerCase() && tokenOut.toLowerCase() !== WETH_ADDRESS.toLowerCase()) {
    paths.push([tokenIn, WETH_ADDRESS, tokenOut]);
  }

  const [v4, v3, v2] = await Promise.all([
    best(
      V4_POOLS.map(async (pool) => {
        const data = await call(V4_QUOTER, encodeV4(currency0, currency1, pool.fee, pool.tick, zeroForOne, quoted));
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
  ]);

  const routes: Route[] = [];
  if (v4) routes.push({ ...base, version: "v4", amountOut: v4.amount, fee: V4_POOLS[v4.index].fee, tick: V4_POOLS[v4.index].tick });
  if (v3) routes.push({ ...base, version: "v3", amountOut: v3.amount, fee: V3_FEES[v3.index] });
  if (v2) routes.push({ ...base, version: "v2", amountOut: v2.amount, path: paths[v2.index] });
  return routes.reduce<Route | null>((winner, route) => (winner == null || route.amountOut > winner.amountOut ? route : winner), null);
}

export async function quoteSwap(payId: string, receiveId: string, amountText: string): Promise<Quote> {
  const [pay, receive] = await Promise.all([resolveToken(payId), resolveToken(receiveId)]);
  const amount = pay ? parseAmount(amountText, pay.decimals) : null;
  if (!pay || !receive || amount == null || amount === 0n) return { version: null, amountOut: null };
  const route = await findRoute(pay, receive, amount);
  if (route === "wrap") return { version: "wrap", amountOut: formatAmount(amount, receive.decimals) };
  if (!route) return { version: null, amountOut: null };
  return { version: route.version, amountOut: formatAmount(route.amountOut, receive.decimals) };
}
