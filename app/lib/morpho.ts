import { connection } from "next/server";

export const CHAIN_ID = 4663;
export const STEAKHOUSE_USDG = "0xBeEff033F34C046626B8D0A041844C5d1A5409dd";
export const BSPY_MARKET_ID = "0xb1453a889f92101054ab8095e0cc5e303f8c797f6ece3f688c7a1e1780a134a6";

const ENDPOINT = "https://api.morpho.org/graphql";

export type MarketRow = {
  id: string;
  collateralSymbol: string;
  collateralName: string;
  collateralLogo: string | null;
  loanSymbol: string;
  loanLogo: string | null;
  supplyUsd: number;
  liquidityUsd: number;
  apy: number;
  allocation: number;
};

export type Holder = { address: string; assetsUsd: number; share: number };

export type VaultTx = { timestamp: number; type: string; amount: number; user: string; hash: string };

export type VaultSnapshot = {
  name: string;
  address: string;
  description: string;
  image: string | null;
  assetSymbol: string;
  assetLogo: string | null;
  assetDecimals: number;
  chain: string;
  curatorName: string;
  curatorImage: string | null;
  curatorAum: number | null;
  createdAt: number;
  totalUsd: number;
  totalTokens: number;
  liquidityUsd: number;
  idleUsd: number;
  sharePrice: number;
  netApy: number;
  nativeApy: number;
  weeklyApy: number | null;
  monthlyApy: number | null;
  ninetyApy: number | null;
  performanceFee: number;
  managementFee: number;
  performanceFeeRecipient: string;
  managementFeeRecipient: string;
  owner: string;
  curatorAddress: string;
  sentinels: string[];
  allocators: string[];
  depositsDisabled: boolean;
  warning: string | null;
  markets: MarketRow[];
  holders: Holder[];
  txs: VaultTx[];
};

export type MarketSnapshot = {
  id: string;
  collateralSymbol: string;
  collateralName: string;
  collateralLogo: string | null;
  loanSymbol: string;
  loanName: string;
  loanLogo: string | null;
  loanDecimals: number;
  supplyUsd: number;
  supplyTokens: number;
  liquidityUsd: number;
  borrowUsd: number;
  apy: number;
  weeklyApy: number | null;
  monthlyApy: number | null;
  utilization: number;
  lltv: number;
  supplyingVaults: string[];
};

export type ListedMarket = {
  id: string;
  collateralSymbol: string;
  collateralLogo: string | null;
  loanSymbol: string;
  loanLogo: string | null;
  supplyUsd: number;
  liquidityUsd: number;
  apy: number;
  source: "Morpho" | "Steakhouse";
  by: string;
};

async function morpho<T>(query: string, variables?: Record<string, string | number>): Promise<T> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Morpho did not answer.");
  const body = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors[0].message);
  if (!body.data) throw new Error("Morpho returned nothing.");
  return body.data;
}

function num(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function addr(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "address" in value) return text((value as { address: unknown }).address);
  return "";
}

function warningText(type: string) {
  if (type === "deposit_disabled") return "Deposits are disabled on this vault.";
  return type.replaceAll("_", " ");
}

const vaultQuery = `
query Steakhouse($address: String!, $chainId: Int!) {
  vaultV2ByAddress(address: $address, chainId: $chainId) {
    name
    address
    creationTimestamp
    totalAssets
    totalAssetsUsd
    idleAssetsUsd
    sharePrice
    apy
    netApy
    weekly: avgNetApy(lookback: SEVEN_DAYS)
    monthly: avgNetApy(lookback: THIRTY_DAYS)
    ninety: avgNetApy(lookback: NINETY_DAYS)
    performanceFee
    managementFee
    performanceFeeRecipient
    managementFeeRecipient
    metadata { description image }
    asset { symbol decimals logoURI }
    chain { network }
    curator { address }
    owner { address }
    sentinels { sentinel { address } }
    allocators { allocator { address } }
    warnings { type }
    curators(first: 1) { items { name image state { aum } } }
    adapters(first: 5) {
      items {
        ... on MorphoMarketV1Adapter {
          positions(first: 20) {
            items {
              state { supplyAssetsUsd }
              market {
                marketId
                collateralAsset { symbol name logoURI }
                loanAsset { symbol logoURI }
                state { supplyApy supplyAssetsUsd liquidityAssetsUsd }
              }
            }
          }
        }
      }
    }
    positions(first: 8) {
      items { assetsUsd user { address } }
    }
  }
  vaultV2transactions(
    first: 12
    orderBy: Time
    orderDirection: Desc
    where: { chainId_in: [$chainId], vaultAddress_in: [$address] }
  ) {
    items {
      timestamp
      type
      assets
      txHash
      data {
        ... on VaultV2DepositData { sender onBehalf }
        ... on VaultV2WithdrawData { receiver onBehalf }
        ... on VaultV2TransferData { to }
      }
    }
  }
}`;

export async function getSteakhouse(): Promise<VaultSnapshot> {
  await connection();
  const data = await morpho<{
    vaultV2ByAddress: Record<string, unknown> | null;
    vaultV2transactions: { items: Record<string, unknown>[] };
  }>(vaultQuery, { address: STEAKHOUSE_USDG, chainId: CHAIN_ID });

  const vault = data.vaultV2ByAddress;
  if (!vault) throw new Error("Morpho did not return the Steakhouse USDG vault.");

  const asset = (vault.asset ?? {}) as Record<string, unknown>;
  const decimals = num(asset.decimals) || 6;
  const curator = ((vault.curators as { items?: Record<string, unknown>[] } | undefined)?.items ?? [])[0];
  const warnings = ((vault.warnings as { type?: string }[] | undefined) ?? []).map((item) => item.type ?? "");
  const totalUsd = num(vault.totalAssetsUsd);
  const idleUsd = num(vault.idleAssetsUsd);

  const markets = ((vault.adapters as { items?: Record<string, unknown>[] } | undefined)?.items ?? [])
    .flatMap((adapter) => ((adapter.positions as { items?: Record<string, unknown>[] } | undefined)?.items ?? []))
    .map((position) => {
      const market = (position.market ?? {}) as Record<string, unknown>;
      const state = (market.state ?? {}) as Record<string, unknown>;
      const positionUsd = num((position.state as { supplyAssetsUsd?: unknown } | undefined)?.supplyAssetsUsd);
      const marketSupply = num(state.supplyAssetsUsd);
      const share = marketSupply > 0 ? Math.min(1, positionUsd / marketSupply) : 0;
      const collateral = (market.collateralAsset ?? {}) as Record<string, unknown>;
      const loan = (market.loanAsset ?? {}) as Record<string, unknown>;
      return {
        id: text(market.marketId),
        collateralSymbol: text(collateral.symbol) || "Idle",
        collateralName: text(collateral.name),
        collateralLogo: text(collateral.logoURI) || null,
        loanSymbol: text(loan.symbol),
        loanLogo: text(loan.logoURI) || null,
        supplyUsd: positionUsd,
        liquidityUsd: num(state.liquidityAssetsUsd) * share,
        apy: num(state.supplyApy),
        allocation: totalUsd > 0 ? positionUsd / totalUsd : 0,
      } satisfies MarketRow;
    })
    .filter((market) => market.id && market.supplyUsd >= 1)
    .sort((a, b) => b.supplyUsd - a.supplyUsd);

  const liquidityUsd = idleUsd + markets.reduce((sum, market) => sum + market.liquidityUsd, 0);
  const holders = ((vault.positions as { items?: Record<string, unknown>[] } | undefined)?.items ?? []).map((item) => {
    const assetsUsd = num(item.assetsUsd);
    return {
      address: addr(item.user),
      assetsUsd,
      share: totalUsd > 0 ? assetsUsd / totalUsd : 0,
    };
  });

  const txs = (data.vaultV2transactions?.items ?? []).map((item) => {
    const payload = (item.data ?? {}) as Record<string, unknown>;
    return {
      timestamp: num(item.timestamp),
      type: text(item.type),
      amount: num(item.assets) / 10 ** decimals,
      user: addr(payload.onBehalf) || addr(payload.receiver) || addr(payload.sender) || addr(payload.to),
      hash: text(item.txHash),
    };
  });

  return {
    name: text(vault.name),
    address: text(vault.address),
    description: text((vault.metadata as { description?: unknown } | undefined)?.description),
    image: text((vault.metadata as { image?: unknown } | undefined)?.image) || text(curator?.image) || null,
    assetSymbol: text(asset.symbol),
    assetLogo: text(asset.logoURI) || null,
    assetDecimals: decimals,
    chain: text((vault.chain as { network?: unknown } | undefined)?.network),
    curatorName: text(curator?.name),
    curatorImage: text(curator?.image) || null,
    curatorAum: curator?.state ? num((curator.state as { aum?: unknown }).aum) : null,
    createdAt: num(vault.creationTimestamp),
    totalUsd,
    totalTokens: num(vault.totalAssets) / 10 ** decimals,
    liquidityUsd,
    idleUsd,
    sharePrice: num(vault.sharePrice),
    netApy: num(vault.netApy),
    nativeApy: num(vault.apy),
    weeklyApy: vault.weekly == null ? null : num(vault.weekly),
    monthlyApy: vault.monthly == null ? null : num(vault.monthly),
    ninetyApy: vault.ninety == null ? null : num(vault.ninety),
    performanceFee: num(vault.performanceFee),
    managementFee: num(vault.managementFee),
    performanceFeeRecipient: text(vault.performanceFeeRecipient),
    managementFeeRecipient: text(vault.managementFeeRecipient),
    owner: addr(vault.owner),
    curatorAddress: addr(vault.curator),
    sentinels: ((vault.sentinels as { sentinel?: unknown }[] | undefined) ?? []).map((item) => addr(item.sentinel)).filter(Boolean),
    allocators: ((vault.allocators as { allocator?: unknown }[] | undefined) ?? []).map((item) => addr(item.allocator)).filter(Boolean),
    depositsDisabled: warnings.includes("deposit_disabled"),
    warning: warnings[0] ? warningText(warnings[0]) : null,
    markets,
    holders,
    txs,
  };
}

const marketQuery = `
query Market($id: String!, $chainId: Int!) {
  markets(first: 1, where: { chainId_in: [$chainId], uniqueKey_in: [$id] }) {
    items {
      marketId
      lltv
      collateralAsset { symbol name logoURI }
      loanAsset { symbol name logoURI decimals }
      state {
        supplyApy
        supplyAssets
        supplyAssetsUsd
        liquidityAssetsUsd
        borrowAssetsUsd
        utilization
        weeklyNetSupplyApy
        monthlyNetSupplyApy
      }
      supplyingVaultV2s { name }
    }
  }
}`;

export async function getMarket(id: string): Promise<MarketSnapshot | null> {
  await connection();
  const data = await morpho<{ markets: { items: Record<string, unknown>[] } }>(marketQuery, {
    id: id.toLowerCase(),
    chainId: CHAIN_ID,
  });
  const market = data.markets.items[0];
  if (!market) return null;
  const collateral = (market.collateralAsset ?? {}) as Record<string, unknown>;
  const loan = (market.loanAsset ?? {}) as Record<string, unknown>;
  const state = (market.state ?? {}) as Record<string, unknown>;
  const decimals = num(loan.decimals) || 6;
  return {
    id: text(market.marketId),
    collateralSymbol: text(collateral.symbol),
    collateralName: text(collateral.name),
    collateralLogo: text(collateral.logoURI) || null,
    loanSymbol: text(loan.symbol),
    loanName: text(loan.name),
    loanLogo: text(loan.logoURI) || null,
    loanDecimals: decimals,
    supplyUsd: num(state.supplyAssetsUsd),
    supplyTokens: num(state.supplyAssets) / 10 ** decimals,
    liquidityUsd: num(state.liquidityAssetsUsd),
    borrowUsd: num(state.borrowAssetsUsd),
    apy: num(state.supplyApy),
    weeklyApy: state.weeklyNetSupplyApy == null ? null : num(state.weeklyNetSupplyApy),
    monthlyApy: state.monthlyNetSupplyApy == null ? null : num(state.monthlyNetSupplyApy),
    utilization: num(state.utilization),
    lltv: num(market.lltv) / 1e18,
    supplyingVaults: ((market.supplyingVaultV2s as { name?: unknown }[] | undefined) ?? []).map((vault) => text(vault.name)).filter(Boolean),
  };
}

const listQuery = `
query Markets($chainId: Int!, $skip: Int!) {
  markets(first: 150, skip: $skip, where: { chainId_in: [$chainId] }) {
    items {
      marketId
      collateralAsset { symbol logoURI }
      loanAsset { symbol logoURI }
      state { supplyApy supplyAssetsUsd liquidityAssetsUsd }
      supplyingVaultV2s { name }
    }
  }
}`;

export async function listMarkets(): Promise<ListedMarket[]> {
  await connection();
  const rows: ListedMarket[] = [];
  for (let skip = 0; skip < 3000; skip += 150) {
    const data = await morpho<{ markets: { items: Record<string, unknown>[] } }>(listQuery, { chainId: CHAIN_ID, skip });
    const items = data.markets.items;
    for (const market of items) {
      const collateral = (market.collateralAsset ?? {}) as Record<string, unknown>;
      const loan = (market.loanAsset ?? {}) as Record<string, unknown>;
      const state = (market.state ?? {}) as Record<string, unknown>;
      const vaults = ((market.supplyingVaultV2s as { name?: unknown }[] | undefined) ?? []).map((vault) => text(vault.name)).filter(Boolean);
      const steakhouse = vaults.find((name) => /steakhouse/i.test(name)) ?? null;
      rows.push({
        id: text(market.marketId),
        collateralSymbol: text(collateral.symbol) || "Unknown",
        collateralLogo: text(collateral.logoURI) || null,
        loanSymbol: text(loan.symbol) || "Unknown",
        loanLogo: text(loan.logoURI) || null,
        supplyUsd: num(state.supplyAssetsUsd),
        liquidityUsd: num(state.liquidityAssetsUsd),
        apy: num(state.supplyApy),
        source: steakhouse ? "Steakhouse" : "Morpho",
        by: steakhouse ?? "Morpho",
      });
    }
    if (items.length < 150) break;
  }
  return rows.sort((a, b) => b.supplyUsd - a.supplyUsd || a.collateralSymbol.localeCompare(b.collateralSymbol));
}
