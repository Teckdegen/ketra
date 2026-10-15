import { poolAddress, tokenById, WETH_ADDRESS } from "./tokens";

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

function parseAmount(value: string, decimals: number) {
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const padded = fraction.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || "0");
}

function formatAmount(value: bigint, decimals: number) {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = (value % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
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
  return amounts.reduce<bigint | null>((bestAmount, amount) => {
    if (amount == null || amount === 0n) return bestAmount;
    if (bestAmount == null || amount > bestAmount) return amount;
    return bestAmount;
  }, null);
}

export async function quoteSwap(payId: string, receiveId: string, amountText: string): Promise<Quote> {
  const pay = tokenById(payId);
  const receive = tokenById(receiveId);
  const amount = pay ? parseAmount(amountText, pay.decimals) : null;
  if (!pay || !receive || amount == null || amount === 0n) return { version: null, amountOut: null };

  const tokenIn = poolAddress(pay);
  const tokenOut = poolAddress(receive);
  if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
    return { version: "wrap", amountOut: formatAmount(amount, receive.decimals) };
  }

  const [currency0, currency1] = [tokenIn, tokenOut].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
  const zeroForOne = tokenIn.toLowerCase() === currency0.toLowerCase();

  const v4 = await best(
    V4_POOLS.map(async (pool) => {
      const data = await call(V4_QUOTER, encodeV4(currency0, currency1, pool.fee, pool.tick, zeroForOne, amount));
      return data ? readWord(data, 0) : null;
    }),
  );
  if (v4) return { version: "v4", amountOut: formatAmount(v4, receive.decimals) };

  const v3 = await best(
    V3_FEES.map(async (fee) => {
      const data = await call(V3_QUOTER, encodeV3(tokenIn, tokenOut, amount, fee));
      return data ? readWord(data, 0) : null;
    }),
  );
  if (v3) return { version: "v3", amountOut: formatAmount(v3, receive.decimals) };

  const direct = await call(V2_ROUTER, encodeV2(amount, [tokenIn, tokenOut]));
  if (direct) {
    const length = Number(readWord(direct, 1));
    const out = readWord(direct, 1 + length);
    if (out > 0n) return { version: "v2", amountOut: formatAmount(out, receive.decimals) };
  }

  if (tokenIn.toLowerCase() !== WETH_ADDRESS.toLowerCase() && tokenOut.toLowerCase() !== WETH_ADDRESS.toLowerCase()) {
    const through = await call(V2_ROUTER, encodeV2(amount, [tokenIn, WETH_ADDRESS, tokenOut]));
    if (through) {
      const length = Number(readWord(through, 1));
      const out = readWord(through, 1 + length);
      if (out > 0n) return { version: "v2", amountOut: formatAmount(out, receive.decimals) };
    }
  }

  return { version: null, amountOut: null };
}
