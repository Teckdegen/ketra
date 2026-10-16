import { getAddress } from "ethers";

/** Robinhood Chain mainnet addresses used by the wallet app. */
export const robinhood = {
  chainId: 4663,
  weth: getAddress("0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73"),
  usdg: getAddress("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"),
  steakUsdg: getAddress("0xBeEff033F34C046626B8D0A041844C5d1A5409dd"),
  morpho: getAddress("0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010"),
  ponsFactory: getAddress("0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e"),
  swapRouter02: getAddress("0xCaf681a66D020601342297493863E78C959E5cb2"),
  v3Factory: getAddress("0x1f7d7550B1b028f7571E69A784071F0205FD2EfA"),
} as const;
