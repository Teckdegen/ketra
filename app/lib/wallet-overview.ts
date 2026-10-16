import {
  AbiCoder,
  Contract,
  Interface,
  ZeroAddress,
  getAddress,
  id,
  zeroPadValue,
  type Log,
  type TransactionReceipt,
} from "ethers";
import { rhjStockAddresses } from "@/lib/rhj-assets";
import { factoryAddress, factoryBlock, provider as connect } from "@/lib/server-chain";
import { robinhood } from "@/lib/robinhood";
import type { ActivityKind } from "@/lib/wallet-types";

const coder = AbiCoder.defaultAbiCoder();
const CHUNK = 9_000_000;
/** Smaller windows for chain-wide Transfer discovery (no contract address filter). */
const DISCOVER_CHUNK = 200_000;
const MAX_ITEMS = 40;
const MAX_TOKENS = 250;
const WETH = robinhood.weth;
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
/** Core rails always checked; official RH stocks come from api.robinhood.com/rhj/assets. */
const DEFAULT_TOKENS = [WETH, robinhood.usdg, robinhood.steakUsdg];
const BALANCE_OF = new Interface(["function balanceOf(address) view returns (uint256)"]);
const MULTICALL_ABI = [
  "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)",
];

const TRANSFER = id("Transfer(address,address,uint256)");
const EXECUTED = id("Executed(uint256,bytes32)");
const FEE = id("FeeCollected(address,uint256)");
const RECEIVED = id("Received(address,uint256)");
const CREATED = id("AccountCreated(address,address,bytes32)");

const accountIface = new Interface([
  "function execute(uint256 nonce, uint256 deadline, uint256 attachedValue, (uint8 action, bytes payload)[] steps, bytes signature)",
]);

const SELECTORS: Record<string, ActivityKind> = {
  "0xa99aad89": "supply",
  "0x5c2bea49": "withdraw",
  "0x8720316d": "withdraw",
  "0x50d8cd4b": "borrow",
  "0x6e553f65": "deposit",
  "0xb460af94": "withdraw",
  "0xba087652": "withdraw",
  "0x8a857083": "deposit",
  "0x2f25807e": "withdraw",
};

export type WalletRaw = {
  created: number;
  eth: string;
  balances: { token: string; balance: string | null }[];
  activity: {
    hash: string;
    block: number;
    time: number;
    kind: ActivityKind;
    counterparty: string | null;
    legs: { token: string; amount: string }[];
  }[];
};

function same(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

function topicAddress(topic: string) {
  return getAddress(`0x${topic.slice(26)}`);
}

function ranges(from: number, to: number, size = CHUNK) {
  const out: [number, number][] = [];
  for (let end = to; end >= from; end -= size) out.push([Math.max(from, end - size + 1), end]);
  return out;
}

async function logs(
  provider: ReturnType<typeof connect>,
  filter: { address?: string; topics?: (string | null)[] },
  from: number,
  to: number,
  size = CHUNK,
) {
  const windows = ranges(from, to, size);
  const out: Log[] = [];
  // Bound concurrency so discovery across many windows does not trip the public RPC.
  for (let i = 0; i < windows.length; i += 6) {
    const batch = windows.slice(i, i + 6);
    const parts = await Promise.all(
      batch.map(([fromBlock, toBlock]) =>
        provider.getLogs({ ...filter, fromBlock, toBlock }).catch(() => [] as Log[]),
      ),
    );
    out.push(...parts.flat());
  }
  return out;
}

async function createdBlock(provider: ReturnType<typeof connect>, owner: string, latest: number) {
  const factory = factoryAddress();
  const floor = factoryBlock();
  const found = await logs(provider, { address: factory, topics: [CREATED, zeroPadValue(owner, 32)] }, floor, latest);
  if (found.length) return Math.min(...found.map((log) => log.blockNumber));
  return Math.max(floor, latest - CHUNK + 1);
}

function decodeSteps(data: string) {
  try {
    const parsed = accountIface.parseTransaction({ data });
    return parsed
      ? parsed.args.steps.map((step: { action: bigint | number; payload: string }) => ({
          action: Number(step.action),
          payload: step.payload,
        }))
      : [];
  } catch {
    return [] as { action: number; payload: string }[];
  }
}

function summarize(owner: string, steps: { action: number; payload: string }[], receipt: TransactionReceipt) {
  const legs = new Map<string, bigint>();
  const add = (token: string, amount: bigint) => legs.set(token, (legs.get(token) ?? 0n) + amount);
  let counterparty: string | null = null;
  const kinds = new Set<string>();

  for (const step of steps) {
    if (step.action === 2) {
      const [to, amount] = coder.decode(["address", "uint256"], step.payload);
      add("ETH", -BigInt(amount));
      counterparty = getAddress(String(to));
      kinds.add("send");
    } else if (step.action === 3) {
      const [, to] = coder.decode(["address", "address", "uint256"], step.payload);
      counterparty = getAddress(String(to));
      kinds.add("send");
    } else if (step.action === 1) {
      const [target, value, data] = coder.decode(["address", "uint256", "bytes"], step.payload);
      const selector = String(data).slice(0, 10).toLowerCase();
      if (same(String(target), WETH)) {
        if (selector === "0xd0e30db0") kinds.add("wrap");
        else if (selector === "0x2e1a7d4d") kinds.add("unwrap");
        continue;
      }
      const ethValue = BigInt(value);
      if (ethValue > 0n) add("ETH", -ethValue);
      kinds.add(SELECTORS[selector] ?? "swap");
    } else if (step.action === 5 || step.action === 6) {
      kinds.add("swap");
    } else if (step.action === 7 || step.action === 8) {
      kinds.add("liquidity");
    }
  }

  const own = receipt.logs;
  const feeBurns = new Set<number>();
  for (let i = 0; i < own.length; i++) {
    const log = own[i]!;
    if (!same(log.address, owner) || log.topics[0] !== FEE || log.topics[1] !== zeroPadValue(ZeroAddress, 32)) continue;
    const fee = BigInt(log.data);
    for (let j = i - 1; j >= 0; j--) {
      const burn = own[j]!;
      if (feeBurns.has(j) || !same(burn.address, WETH) || burn.topics[0] !== TRANSFER || burn.topics.length < 3) continue;
      if (same(topicAddress(burn.topics[1]!), owner) && same(topicAddress(burn.topics[2]!), ZeroAddress) && BigInt(burn.data) === fee) {
        feeBurns.add(j);
        break;
      }
    }
  }

  own.forEach((log: Log, index: number) => {
    if (same(log.address, owner) && log.topics[0] === RECEIVED && !same(topicAddress(log.topics[1]!), WETH)) {
      add("ETH", BigInt(log.data));
      return;
    }
    if (log.topics[0] !== TRANSFER || log.topics.length !== 3 || log.data.length < 66) return;
    const from = topicAddress(log.topics[1]!);
    const to = topicAddress(log.topics[2]!);
    const amount = BigInt(log.data.slice(0, 66));
    const token = getAddress(log.address);
    if (same(to, owner)) add(token, amount);
    if (same(from, owner)) add(token, -amount);
    if (same(token, WETH)) {
      if (same(from, ZeroAddress) && same(to, owner)) add("ETH", -amount);
      if (same(from, owner) && same(to, ZeroAddress) && !feeBurns.has(index)) add("ETH", amount);
    }
  });

  const out = [...legs].filter(([, amount]) => amount !== 0n).map(([token, amount]) => ({ token, amount: amount.toString() }));
  const spent = out.some((leg) => leg.amount.startsWith("-"));
  const got = out.some((leg) => !leg.amount.startsWith("-"));
  let kind: ActivityKind = "call";
  for (const candidate of ["send", "supply", "deposit", "withdraw", "borrow", "liquidity"] as ActivityKind[]) {
    if (kinds.has(candidate)) {
      kind = candidate;
      break;
    }
  }
  if (kind === "call") {
    if (kinds.has("swap") || (spent && got && !kinds.has("wrap") && !kinds.has("unwrap"))) kind = "swap";
    else if (kinds.has("wrap")) kind = "wrap";
    else if (kinds.has("unwrap")) kind = "unwrap";
  }
  return { kind, legs: out, counterparty };
}

export async function walletOverview(input: {
  account: string;
  tokens?: string[];
  from?: number;
}): Promise<WalletRaw> {
  const owner = getAddress(input.account);
  const provider = connect();
  const latest = await provider.getBlockNumber();
  const created = Number.isInteger(input.from) && (input.from ?? 0) > 0 ? input.from! : await createdBlock(provider, owner, latest);
  const padded = zeroPadValue(owner, 32);

  const tracked = new Map<string, string>();
  const addToken = (value: string) => {
    try {
      tracked.set(getAddress(value).toLowerCase(), getAddress(value));
    } catch {
      /* skip bad token */
    }
  };
  for (const token of [...DEFAULT_TOKENS, ...(Array.isArray(input.tokens) ? input.tokens.slice(0, 40) : [])]) {
    addToken(token);
  }
  // Official Robinhood stock / ETF tokens — balances via Multicall even if Transfer discovery misses them.
  for (const token of await rhjStockAddresses()) addToken(token);
  const primaryTokens = [...tracked.values()].slice(0, MAX_TOKENS);

  // Balances run in parallel with log discovery so slow Transfer scans cannot hide stocks.
  const balancesPromise = Promise.all([
    provider.getBalance(owner),
    balancesOf(provider, owner, primaryTokens),
  ]);

  // Discover any ERC-20 sent to the account (memes, vault shares), not just the default list.
  const [ownLogs, inboundLogs] = await Promise.all([
    logs(provider, { address: owner }, created, latest),
    logs(provider, { topics: [TRANSFER, null, padded] }, created, latest, DISCOVER_CHUNK),
  ]);
  for (const log of inboundLogs) {
    addToken(log.address);
  }

  const executed = [...new Set(ownLogs.filter((log) => log.topics[0] === EXECUTED).map((log) => log.transactionHash))];
  const items = new Map<
    string,
    { hash: string; block: number; kind: ActivityKind; counterparty: string | null; legs: { token: string; amount: string }[] }
  >();

  const recentExecuted = ownLogs
    .filter((log) => log.topics[0] === EXECUTED)
    .sort((a, b) => b.blockNumber - a.blockNumber)
    .slice(0, MAX_ITEMS);
  await Promise.all(
    recentExecuted.map(async (log) => {
      const [tx, receipt] = await Promise.all([
        provider.getTransaction(log.transactionHash),
        provider.getTransactionReceipt(log.transactionHash),
      ]);
      if (!tx || !receipt) return;
      for (const entry of receipt.logs) {
        if (entry.topics[0] !== TRANSFER || entry.topics.length !== 3) continue;
        if (entry.topics[1] === padded || entry.topics[2] === padded) {
          tracked.set(entry.address.toLowerCase(), getAddress(entry.address));
        }
      }
      const summary = summarize(owner, decodeSteps(tx.data), receipt);
      items.set(log.transactionHash, { hash: log.transactionHash, block: log.blockNumber, ...summary });
    }),
  );

  const incoming = new Map<
    string,
    { hash: string; block: number; kind: ActivityKind; legs: Map<string, bigint>; counterparty: string }
  >();
  for (const log of inboundLogs) {
    if (executed.includes(log.transactionHash) || log.topics[2] !== padded) continue;
    const entry =
      incoming.get(log.transactionHash) ??
      {
        hash: log.transactionHash,
        block: log.blockNumber,
        kind: "receive" as const,
        legs: new Map<string, bigint>(),
        counterparty: topicAddress(log.topics[1]!),
      };
    const token = getAddress(log.address);
    entry.legs.set(token, (entry.legs.get(token) ?? 0n) + BigInt(log.data.slice(0, 66)));
    incoming.set(log.transactionHash, entry);
  }
  for (const log of ownLogs) {
    if (log.topics[0] !== RECEIVED || executed.includes(log.transactionHash)) continue;
    const from = topicAddress(log.topics[1]!);
    if (same(from, WETH)) continue;
    const entry =
      incoming.get(log.transactionHash) ??
      {
        hash: log.transactionHash,
        block: log.blockNumber,
        kind: "receive" as const,
        legs: new Map<string, bigint>(),
        counterparty: from,
      };
    entry.legs.set("ETH", (entry.legs.get("ETH") ?? 0n) + BigInt(log.data));
    incoming.set(log.transactionHash, entry);
  }
  for (const entry of incoming.values()) {
    items.set(entry.hash, {
      ...entry,
      legs: [...entry.legs].map(([token, amount]) => ({ token, amount: amount.toString() })),
    });
  }

  const activity = [...items.values()].sort((a, b) => b.block - a.block).slice(0, MAX_ITEMS);
  const blocks = [...new Set(activity.map((item) => item.block))];
  const primaryKnown = new Set(primaryTokens.map((token) => token.toLowerCase()));
  const extraTokens = [...tracked.values()].filter((token) => !primaryKnown.has(token.toLowerCase())).slice(0, Math.max(0, MAX_TOKENS - primaryTokens.length));

  const [[eth, primaryBalances], times, extraBalances] = await Promise.all([
    balancesPromise,
    Promise.all(blocks.map(async (block) => [block, (await provider.getBlock(block))?.timestamp ?? 0] as const)).then(
      (entries) => new Map(entries),
    ),
    extraTokens.length ? balancesOf(provider, owner, extraTokens) : Promise.resolve([] as (bigint | null)[]),
  ]);

  const tokenList = [...primaryTokens, ...extraTokens];
  const tokenBalances = [...primaryBalances, ...extraBalances];

  return {
    created,
    eth: eth.toString(),
    balances: tokenList.map((token, index) => ({
      token,
      balance: tokenBalances[index] == null ? null : tokenBalances[index]!.toString(),
    })),
    activity: activity.map((item) => ({ ...item, time: times.get(item.block) ?? 0 })),
  };
}

async function balancesOf(
  provider: ReturnType<typeof connect>,
  owner: string,
  tokens: string[],
): Promise<(bigint | null)[]> {
  if (!tokens.length) return [];
  const calls = tokens.map((token) => ({
    target: token,
    allowFailure: true,
    callData: BALANCE_OF.encodeFunctionData("balanceOf", [owner]),
  }));
  try {
    const multicall = new Contract(MULTICALL3, MULTICALL_ABI, provider);
    const results: { success: boolean; returnData: string }[] = await multicall.aggregate3.staticCall(calls);
    return results.map((result) => {
      if (!result.success || !result.returnData || result.returnData === "0x") return null;
      try {
        return BALANCE_OF.decodeFunctionResult("balanceOf", result.returnData)[0] as bigint;
      } catch {
        return null;
      }
    });
  } catch {
    // Fallback: chunked direct balanceOf if Multicall fails.
    const out: (bigint | null)[] = [];
    for (let i = 0; i < tokens.length; i += 40) {
      const batch = tokens.slice(i, i + 40);
      const parts = await Promise.all(
        batch.map((token) =>
          new Contract(token, ["function balanceOf(address) view returns (uint256)"], provider)
            .balanceOf(owner)
            .catch(() => null),
        ),
      );
      out.push(...parts);
    }
    return out;
  }
}
