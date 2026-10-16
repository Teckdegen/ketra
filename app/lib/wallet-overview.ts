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
import { blockscoutTokenBalances, blockscoutTokenTransfers } from "@/lib/blockscout";
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

  // Stocks: official RHJ registry + Multicall (Blockscout multipliers/junk holdings broke stock display).
  // Blockscout: token-transfers for activity + non-stock ERC-20 holdings only.
  const stockAddresses = await rhjStockAddresses();
  const stockSet = new Set(stockAddresses.map((token) => token.toLowerCase()));

  const [scoutBalances, scoutTransfers, eth] = await Promise.all([
    blockscoutTokenBalances(owner),
    blockscoutTokenTransfers(owner, MAX_ITEMS * 2),
    provider.getBalance(owner),
  ]);

  const tracked = new Map<string, string>();
  const addToken = (value: string) => {
    try {
      tracked.set(getAddress(value).toLowerCase(), getAddress(value));
    } catch {
      /* skip */
    }
  };
  for (const token of [...DEFAULT_TOKENS, ...stockAddresses, ...(Array.isArray(input.tokens) ? input.tokens.slice(0, 40) : [])]) {
    addToken(token);
  }
  // Non-stock holdings from Blockscout (memes, vault shares) — never trust scout for RH stock balances.
  if (scoutBalances) {
    for (const row of scoutBalances) {
      if (!stockSet.has(row.token.toLowerCase())) addToken(row.token);
    }
  }

  const items = new Map<
    string,
    { hash: string; block: number; time?: number; kind: ActivityKind; counterparty: string | null; legs: { token: string; amount: string }[] }
  >();

  // Prefer Blockscout token transfers for receive/send of ERC-20s (stocks, memes, vault shares).
  if (scoutTransfers) {
    for (const transfer of scoutTransfers) {
      const toOwner = same(transfer.to, owner);
      const fromOwner = same(transfer.from, owner);
      if (!toOwner && !fromOwner) continue;
      // Skip transfers already covered as Ketra execute sends when we load own logs below — merge by hash.
      const kind: ActivityKind = toOwner && !fromOwner ? "receive" : fromOwner && !toOwner ? "send" : "swap";
      const amount = toOwner && !fromOwner ? transfer.amount : `-${transfer.amount}`;
      const existing = items.get(transfer.hash);
      if (existing) {
        existing.legs.push({ token: transfer.token, amount });
        if (!existing.counterparty) existing.counterparty = toOwner ? transfer.from : transfer.to;
        continue;
      }
      items.set(transfer.hash, {
        hash: transfer.hash,
        block: transfer.block,
        time: transfer.time,
        kind,
        counterparty: toOwner ? transfer.from : transfer.to,
        legs: [{ token: transfer.token, amount }],
      });
    }
  }

  // Ketra account executes + native ETH receives from on-chain logs.
  const ownLogs = await logs(provider, { address: owner }, created, latest);
  const executed = [...new Set(ownLogs.filter((log) => log.topics[0] === EXECUTED).map((log) => log.transactionHash))];

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
        if (entry.topics[1] === padded || entry.topics[2] === padded) addToken(entry.address);
      }
      const summary = summarize(owner, decodeSteps(tx.data), receipt);
      // Ketra execute summary wins over raw transfer rows for the same hash.
      items.set(log.transactionHash, { hash: log.transactionHash, block: log.blockNumber, ...summary });
    }),
  );

  for (const log of ownLogs) {
    if (log.topics[0] !== RECEIVED || executed.includes(log.transactionHash)) continue;
    const from = topicAddress(log.topics[1]!);
    if (same(from, WETH)) continue;
    const existing = items.get(log.transactionHash);
    if (existing) {
      existing.legs.push({ token: "ETH", amount: BigInt(log.data).toString() });
      continue;
    }
    items.set(log.transactionHash, {
      hash: log.transactionHash,
      block: log.blockNumber,
      kind: "receive",
      counterparty: from,
      legs: [{ token: "ETH", amount: BigInt(log.data).toString() }],
    });
  }

  // Fallback Transfer discovery only when Blockscout is unavailable.
  if (!scoutTransfers) {
    const inboundLogs = await logs(provider, { topics: [TRANSFER, null, padded] }, created, latest, DISCOVER_CHUNK);
    for (const log of inboundLogs) addToken(log.address);
    for (const log of inboundLogs) {
      if (executed.includes(log.transactionHash) || log.topics[2] !== padded) continue;
      if (items.has(log.transactionHash)) continue;
      items.set(log.transactionHash, {
        hash: log.transactionHash,
        block: log.blockNumber,
        kind: "receive",
        counterparty: topicAddress(log.topics[1]!),
        legs: [{ token: getAddress(log.address), amount: BigInt(log.data.slice(0, 66)).toString() }],
      });
    }
  }

  const activity = [...items.values()].sort((a, b) => b.block - a.block).slice(0, MAX_ITEMS);
  const needTime = activity.filter((item) => !item.time);
  const times = new Map(
    await Promise.all(
      [...new Set(needTime.map((item) => item.block))].map(
        async (block) => [block, (await provider.getBlock(block))?.timestamp ?? 0] as const,
      ),
    ),
  );

  // Always Multicall RHJ stocks + rails + imports. Blockscout only fills other non-stock holdings.
  const imported = new Set(
    (Array.isArray(input.tokens) ? input.tokens : []).map((token) => {
      try {
        return getAddress(token).toLowerCase();
      } catch {
        return "";
      }
    }),
  );
  const primaryTokens = [...tracked.values()]
    .filter(
      (token) =>
        stockSet.has(token.toLowerCase()) ||
        DEFAULT_TOKENS.some((d) => same(d, token)) ||
        imported.has(token.toLowerCase()),
    )
    .slice(0, MAX_TOKENS);
  const primaryKnown = new Set(primaryTokens.map((token) => token.toLowerCase()));
  const extraFromScout = scoutBalances
    ? scoutBalances
        .filter((row) => !stockSet.has(row.token.toLowerCase()) && !primaryKnown.has(row.token.toLowerCase()))
        .slice(0, 40)
    : [];
  const extraTracked = [...tracked.values()]
    .filter(
      (token) =>
        !primaryKnown.has(token.toLowerCase()) &&
        !extraFromScout.some((row) => same(row.token, token)) &&
        !stockSet.has(token.toLowerCase()),
    )
    .slice(0, Math.max(0, 40 - extraFromScout.length));

  const needRpc = [...primaryTokens, ...extraTracked];
  const rpcBalances = await balancesOf(provider, owner, needRpc);
  const byToken = new Map<string, string | null>();
  needRpc.forEach((token, index) => {
    byToken.set(token.toLowerCase(), rpcBalances[index] == null ? null : rpcBalances[index]!.toString());
  });
  for (const row of extraFromScout) {
    byToken.set(row.token.toLowerCase(), row.balance);
  }

  const balances = [...byToken.entries()].slice(0, MAX_TOKENS).map(([token, balance]) => ({
    token: getAddress(token),
    balance,
  }));

  return {
    created,
    eth: eth.toString(),
    balances,
    activity: activity.map((item) => ({
      hash: item.hash,
      block: item.block,
      time: item.time || times.get(item.block) || 0,
      kind: item.kind,
      counterparty: item.counterparty,
      legs: item.legs,
    })),
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
