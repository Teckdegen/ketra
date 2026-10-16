import { formatAmount } from "@/lib/amount";
import { tokenInfo } from "@/lib/chain";
import { allow } from "@/lib/limit";
import { ethUsdPrice, valuesOf } from "@/lib/price";
import { runScript } from "@/lib/relay";
import { isAddress, tokenById, type Token } from "@/lib/tokens";
import type { ActivityItem, ActivityKind, WalletAsset, WalletOverview } from "@/lib/wallet-types";

const CACHE_TTL = 15 * 1000;

type Raw = {
  created: number;
  eth: string;
  balances: { token: string; balance: string | null }[];
  activity: { hash: string; block: number; time: number; kind: ActivityKind; counterparty: string | null; legs: { token: string; amount: string }[] }[];
};

const created = new Map<string, number>();
const cache = new Map<string, { at: number; overview: WalletOverview }>();

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { account?: string; tokens?: unknown; fresh?: boolean } | null;
  const account = body?.account ?? "";
  if (!isAddress(account)) return Response.json({ error: "This wallet has no account yet." }, { status: 400 });
  const extra = Array.isArray(body?.tokens) ? body.tokens.filter((item): item is string => typeof item === "string" && isAddress(item)).slice(0, 40) : [];
  const key = `${account.toLowerCase()}|${extra.map((item) => item.toLowerCase()).sort().join(",")}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL && !body?.fresh) return Response.json(hit.overview);
  if (!allow("wallet", request, 40, 60 * 1000)) return Response.json({ error: "Too many requests. Wait a moment." }, { status: 429 });

  let raw: Raw;
  try {
    raw = await runScript<Raw>("wallet.cjs", { op: "overview", account, tokens: extra, from: created.get(account.toLowerCase()) }, 90000);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The wallet could not be read." }, { status: 502 });
  }
  created.set(account.toLowerCase(), raw.created);

  const addresses = new Set<string>();
  raw.balances.forEach((item) => addresses.add(item.token.toLowerCase()));
  raw.activity.forEach((item) => item.legs.forEach((leg) => leg.token !== "ETH" && addresses.add(leg.token.toLowerCase())));
  const infos = new Map<string, Token | null>(await Promise.all([...addresses].map(async (address) => [address, await tokenInfo(address)] as const)));
  const eth = tokenById("ETH")!;
  const tokenFor = (id: string) => (id === "ETH" ? eth : (infos.get(id.toLowerCase()) ?? null));

  const ethRaw = BigInt(raw.eth);
  const imported = new Set(extra.map((item) => item.toLowerCase()));
  const pending: { token: Token; amount: bigint }[] = [{ token: eth, amount: ethRaw }];
  for (const item of raw.balances) {
    const token = tokenFor(item.token);
    if (!token || item.balance == null) continue;
    const amount = BigInt(item.balance);
    if (amount === 0n && !imported.has(item.token.toLowerCase())) continue;
    pending.push({ token, amount });
  }

  const [ethUsd, valued] = await Promise.all([ethUsdPrice(), valuesOf(pending)]);
  const assets: WalletAsset[] = pending.map(({ token, amount }) => {
    const value = valued.get(token.id) ?? { eth: null, usd: null };
    return { token, balance: formatAmount(amount, token.decimals), eth: value.eth, usd: value.usd };
  });
  assets.sort((a, b) => (a.token.id === "ETH" ? -1 : b.token.id === "ETH" ? 1 : (b.usd ?? b.eth ?? -1) - (a.usd ?? a.eth ?? -1)));

  const activity: ActivityItem[] = raw.activity.map((item) => ({
    hash: item.hash,
    time: item.time,
    kind: item.kind,
    counterparty: item.counterparty,
    legs: item.legs.flatMap((leg) => {
      const token = tokenFor(leg.token);
      return token ? [{ token, amount: formatAmount(BigInt(leg.amount), token.decimals) }] : [];
    }),
  }));

  const withEth = assets.filter((asset) => asset.eth != null);
  const withUsd = assets.filter((asset) => asset.usd != null);
  const overview: WalletOverview = {
    account,
    totalEth: withEth.length ? withEth.reduce((sum, asset) => sum + (asset.eth ?? 0), 0) : null,
    totalUsd: withUsd.length ? withUsd.reduce((sum, asset) => sum + (asset.usd ?? 0), 0) : null,
    ethUsd,
    assets,
    activity,
    updated: Date.now(),
  };
  cache.set(key, { at: Date.now(), overview });
  return Response.json(overview);
}
