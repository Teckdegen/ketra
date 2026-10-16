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
import { factoryAddress, factoryBlock, provider as connect } from "@/lib/server-chain";
import { robinhood } from "@/lib/robinhood";
import type { ActivityKind } from "@/lib/wallet-types";

const coder = AbiCoder.defaultAbiCoder();
const CHUNK = 9_000_000;
const MAX_ITEMS = 40;
const WETH = robinhood.weth;
const DEFAULT_TOKENS = [WETH, robinhood.usdg, robinhood.steakUsdg];

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

function ranges(from: number, to: number) {
  const out: [number, number][] = [];
  for (let end = to; end >= from; end -= CHUNK) out.push([Math.max(from, end - CHUNK + 1), end]);
  return out;
}

async function logs(
  provider: ReturnType<typeof connect>,
  filter: { address?: string; topics?: (string | null)[] },
  from: number,
  to: number,
) {
  const parts = await Promise.all(
    ranges(from, to).map(([fromBlock, toBlock]) => provider.getLogs({ ...filter, fromBlock, toBlock })),
  );
  return parts.flat();
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
      add("ETH", -amount);
      counterparty = getAddress(to);
      kinds.add("send");
    } else if (step.action === 3) {
      const [, to] = coder.decode(["address", "address", "uint256"], step.payload);
      counterparty = getAddress(to);
      kinds.add("send");
    } else if (step.action === 1) {
      const [target, value, data] = coder.decode(["address", "uint256", "bytes"], step.payload);
      const selector = String(data).slice(0, 10).toLowerCase();
      if (same(target, WETH)) {
        if (selector === "0xd0e30db0") kinds.add("wrap");
        else if (selector === "0x2e1a7d4d") kinds.add("unwrap");
        continue;
      }
      if (value > 0n) add("ETH", -value);
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
  for (const token of [...DEFAULT_TOKENS, ...(Array.isArray(input.tokens) ? input.tokens.slice(0, 40) : [])]) {
    try {
      tracked.set(getAddress(token).toLowerCase(), getAddress(token));
    } catch {
      /* skip bad token */
    }
  }

  const [ownLogs, ...tokenLogs] = await Promise.all([
    logs(provider, { address: owner }, created, latest),
    ...[...tracked.values()].flatMap((token) => [
      logs(provider, { address: token, topics: [TRANSFER, null, padded] }, created, latest),
      logs(provider, { address: token, topics: [TRANSFER, padded] }, created, latest),
    ]),
  ]);

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
  for (const log of tokenLogs.flat()) {
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
  const times = new Map(
    await Promise.all(blocks.map(async (block) => [block, (await provider.getBlock(block))?.timestamp ?? 0] as const)),
  );

  const erc20 = ["function balanceOf(address) view returns (uint256)"];
  const tokenList = [...tracked.values()].slice(0, 60);
  const [eth, ...tokenBalances] = await Promise.all([
    provider.getBalance(owner),
    ...tokenList.map((token) => new Contract(token, erc20, provider).balanceOf(owner).catch(() => null)),
  ]);

  return {
    created,
    eth: eth.toString(),
    balances: tokenList.map((token, index) => ({
      token,
      balance: tokenBalances[index] == null ? null : tokenBalances[index].toString(),
    })),
    activity: activity.map((item) => ({ ...item, time: times.get(item.block) ?? 0 })),
  };
}
