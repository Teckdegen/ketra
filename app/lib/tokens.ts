export type Token = {
  id: "ETH" | "WETH" | "USDG";
  symbol: string;
  name: string;
  decimals: number;
  logo: string;
  address: string | null;
};

export const WETH_ADDRESS = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
export const USDG_ADDRESS = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";

export const tokens: Token[] = [
  {
    id: "ETH",
    symbol: "ETH",
    name: "Ether",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    address: null,
  },
  {
    id: "WETH",
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    logo: "https://cdn.morpho.org/assets/logos/weth.svg",
    address: WETH_ADDRESS,
  },
  {
    id: "USDG",
    symbol: "USDG",
    name: "Global Dollar",
    decimals: 6,
    logo: "https://cdn.morpho.org/assets/logos/usdg.svg",
    address: USDG_ADDRESS,
  },
];

export function tokenById(id: string) {
  return tokens.find((token) => token.id === id) ?? null;
}

export function poolAddress(token: Token) {
  return token.address ?? WETH_ADDRESS;
}
