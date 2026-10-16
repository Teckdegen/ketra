import { Contract, formatUnits, getAddress } from "ethers";
import { BSPY_MARKET_ID, STEAKHOUSE_USDG } from "@/lib/morpho";
import { mainnet } from "@/lib/robinhood-steps";
import { provider as connect } from "@/lib/server-chain";
import { tokenById } from "@/lib/tokens";

export type UserPosition = {
  id: string;
  kind: "morpho" | "steakhouse";
  title: string;
  subtitle: string;
  symbol: string;
  logo: string;
  assets: string;
  assetsRaw: string;
  sharesRaw: string;
  usd: number;
  href: string;
};

export type MorphoSupplyPosition = {
  shares: bigint;
  assets: bigint;
};

/** Morpho Blue uses 1 virtual asset and 1e6 virtual shares on every market. */
function sharesToAssets(shares: bigint, totalAssets: bigint, totalShares: bigint) {
  if (shares === 0n) return 0n;
  return (shares * (totalAssets + 1n)) / (totalShares + 1_000_000n);
}

function morphoContract(provider = connect()) {
  return new Contract(
    mainnet.morpho,
    [
      "function position(bytes32 id, address user) view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)",
      "function market(bytes32 id) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)",
    ],
    provider,
  );
}

/** Raw Morpho supply shares/assets for the wired USDG / bSPY market. */
export async function morphoSupplyPosition(accountRaw: string): Promise<MorphoSupplyPosition> {
  const account = getAddress(accountRaw);
  const morpho = morphoContract();
  const [pos, market] = await Promise.all([morpho.position(BSPY_MARKET_ID, account), morpho.market(BSPY_MARKET_ID)]);
  const shares = BigInt(pos.supplyShares ?? pos[0] ?? 0);
  const totalSupplyAssets = BigInt(market.totalSupplyAssets ?? market[0] ?? 0);
  const totalSupplyShares = BigInt(market.totalSupplyShares ?? market[1] ?? 0);
  return { shares, assets: sharesToAssets(shares, totalSupplyAssets, totalSupplyShares) };
}

/** On-chain Morpho market + Steakhouse vault balances for a Ketra account. */
export async function positionsFor(accountRaw: string): Promise<UserPosition[]> {
  const account = getAddress(accountRaw);
  const provider = connect();
  const usdg = tokenById("USDG")!;
  const out: UserPosition[] = [];

  try {
    const { shares, assets } = await morphoSupplyPosition(account);
    if (assets > 0n && shares > 0n) {
      const amount = formatUnits(assets, usdg.decimals);
      out.push({
        id: "morpho-bspy",
        kind: "morpho",
        title: "USDG / bSPY",
        subtitle: "Morpho",
        symbol: usdg.symbol,
        logo: usdg.logo,
        assets: amount,
        assetsRaw: assets.toString(),
        sharesRaw: shares.toString(),
        usd: Number(amount),
        href: `/supply/${BSPY_MARKET_ID}`,
      });
    }
  } catch {
    /* market unread */
  }

  const vault = new Contract(
    STEAKHOUSE_USDG,
    ["function balanceOf(address) view returns (uint256)", "function convertToAssets(uint256) view returns (uint256)"],
    provider,
  );

  try {
    const shares = BigInt(await vault.balanceOf(account));
    if (shares > 0n) {
      const assets = BigInt(await vault.convertToAssets(shares));
      if (assets > 0n) {
        const amount = formatUnits(assets, usdg.decimals);
        out.push({
          id: "steakhouse-usdg",
          kind: "steakhouse",
          title: "Steakhouse USDG",
          subtitle: "Vault",
          symbol: usdg.symbol,
          logo: usdg.logo,
          assets: amount,
          assetsRaw: assets.toString(),
          sharesRaw: shares.toString(),
          usd: Number(amount),
          href: "/vault",
        });
      }
    }
  } catch {
    /* vault unread */
  }

  return out;
}
