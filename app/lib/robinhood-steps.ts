import { AbiCoder, getAddress } from "ethers";

export type Step = [number, string];

const coder = AbiCoder.defaultAbiCoder();

const TRANSFER_FEE_BPS = 10n;
const DEFI_FEE_BPS = 50n;

export function transferFee(amount: bigint) {
  return (BigInt(amount) * TRANSFER_FEE_BPS) / 10000n;
}

export function defiFee(amount: bigint) {
  return (BigInt(amount) * DEFI_FEE_BPS) / 10000n;
}

const ACTION_CALL = 1;
const ACTION_APPROVE = 4;
const ACTION_SWAP_V2 = 5;
const ACTION_SWAP_V3 = 6;
const ACTION_SET_ALLOWED = 9;

export const mainnet = {
  chainId: 4663,
  swapRouter02: getAddress("0xCaf681a66D020601342297493863E78C959E5cb2"),
  v3Factory: getAddress("0x1f7d7550B1b028f7571E69A784071F0205FD2EfA"),
  universalRouter: getAddress("0x8876789976dEcBfCbBbe364623C63652db8C0904"),
  permit2: getAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3"),
  v4PoolManager: getAddress("0x8366a39CC670B4001A1121B8F6A443A643e40951"),
  weth: getAddress("0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73"),
  usdg: getAddress("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"),
  morpho: getAddress("0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010"),
  steakUsdg: getAddress("0xBeEff033F34C046626B8D0A041844C5d1A5409dd"),
  lighter: getAddress("0x94bAB9693Ba2f6358507eFfcbd372b0660AFfF9d"),
  lighterUsdgAssetIndex: 3,
  lighterPerpsRoute: 0,
  morphoUsdgBspy: {
    loanToken: getAddress("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"),
    collateralToken: getAddress("0xC3ED4a5A7dB4102F4Ed37Af26ef0d3f21e2360c1"),
    oracle: getAddress("0xac6E0472981877dcebb1527E417b5CB6133721b3"),
    irm: getAddress("0x2BD3d5965B26B51814AC95127B2b80dD6CcC0fa1"),
    lltv: 625000000000000000n,
  },
  ponsFactory: getAddress("0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e"),
  ponsMemeHook: getAddress("0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044"),
  v4WethUsdg: {
    currency0: getAddress("0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73"),
    currency1: getAddress("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"),
    fee: 8388608,
    tickSpacing: 60,
    hooks: getAddress("0x2De9D39fF7B49BA0f28b5dC17c7567f1221350C4"),
  },
} as const;

export function allow(target: string): Step {
  return [ACTION_SET_ALLOWED, coder.encode(["address", "bool"], [getAddress(target), true])];
}

function approve(token: string, spender: string, amount: bigint): Step {
  return [ACTION_APPROVE, coder.encode(["address", "address", "uint256"], [getAddress(token), getAddress(spender), amount])];
}

function call(target: string, data: string, value = 0n): Step {
  return [ACTION_CALL, coder.encode(["address", "uint256", "bytes"], [getAddress(target), value, data])];
}

export function v2SwapStep({
  router,
  amountIn,
  amountOutMin,
  path,
  deadline,
}: {
  router: string;
  amountIn: bigint;
  amountOutMin: bigint;
  path: string[];
  deadline: number;
}): Step {
  return [
    ACTION_SWAP_V2,
    coder.encode(
      ["address", "uint256", "uint256", "address[]", "uint256"],
      [getAddress(router), amountIn, amountOutMin, path.map(getAddress), deadline],
    ),
  ];
}

const SWAP_ROUTER_02_EXACT_INPUT = "0x04e45aaf";
const UNIVERSAL_ROUTER_EXECUTE = "0x3593564c";
const PERMIT2_APPROVE = "0x87517c45";
const MORPHO_SUPPLY = "0xa99aad89";
const MORPHO_WITHDRAW = "0x5c2bea49";
const STEAKHOUSE_DEPOSIT = "0x6e553f65";
const STEAKHOUSE_WITHDRAW = "0xb460af94";
const PONS_CURVE_BUY = "0x59a87bc1";
const PONS_CURVE_SELL = "0xd04c6983";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function allowAndCall({
  target,
  token,
  amount,
  data,
}: {
  target: string;
  token?: string;
  amount?: bigint;
  data: string;
}): Step[] {
  const steps: Step[] = [allow(target)];
  if (token && amount != null) steps.push(approve(token, target, amount));
  steps.push(call(target, data));
  if (token) steps.push(approve(token, target, 0n));
  return steps;
}

export function v3Router02Steps({
  router,
  tokenIn,
  tokenOut,
  fee,
  account,
  amountIn,
  amountOutMin,
  sqrtPriceLimitX96 = 0,
}: {
  router: string;
  tokenIn: string;
  tokenOut: string;
  fee: number;
  account: string;
  amountIn: bigint;
  amountOutMin: bigint;
  sqrtPriceLimitX96?: number | bigint;
}): Step[] {
  const args = coder.encode(
    ["tuple(address,address,uint24,address,uint256,uint256,uint160)"],
    [[getAddress(tokenIn), getAddress(tokenOut), fee, getAddress(account), amountIn, amountOutMin, sqrtPriceLimitX96 || 0]],
  );
  return allowAndCall({
    target: router,
    token: tokenIn,
    amount: amountIn,
    data: SWAP_ROUTER_02_EXACT_INPUT + args.slice(2),
  });
}

function v4SwapInput({
  pool,
  zeroForOne,
  amountIn,
  amountOutMin,
}: {
  pool: { currency0: string; currency1: string; fee: number; tickSpacing: number; hooks: string };
  zeroForOne: boolean;
  amountIn: bigint;
  amountOutMin: bigint;
}) {
  const inputCurrency = zeroForOne ? pool.currency0 : pool.currency1;
  const outputCurrency = zeroForOne ? pool.currency1 : pool.currency0;
  const actions = "0x060c0f";
  const params = [
    coder.encode(
      ["tuple(tuple(address,address,uint24,int24,address),bool,uint128,uint128,uint256,bytes)"],
      [[[pool.currency0, pool.currency1, pool.fee, pool.tickSpacing, pool.hooks], zeroForOne, amountIn, amountOutMin, 0, "0x"]],
    ),
    coder.encode(["address", "uint256"], [inputCurrency, amountIn]),
    coder.encode(["address", "uint256"], [outputCurrency, amountOutMin]),
  ];
  return coder.encode(["bytes", "bytes[]"], [actions, params]);
}

export function v4SwapSteps({
  router,
  permit2,
  pool,
  zeroForOne,
  amountIn,
  amountOutMin,
  deadline,
}: {
  router: string;
  permit2: string;
  pool: { currency0: string; currency1: string; fee: number; tickSpacing: number; hooks: string };
  zeroForOne: boolean;
  amountIn: bigint;
  amountOutMin: bigint;
  deadline: number;
}): Step[] {
  const token = getAddress(zeroForOne ? pool.currency0 : pool.currency1);
  const routerAddress = getAddress(router);
  const permit2Address = getAddress(permit2);
  const executeArgs = coder.encode(
    ["bytes", "bytes[]", "uint256"],
    ["0x10", [v4SwapInput({ pool, zeroForOne, amountIn, amountOutMin })], deadline],
  );
  if (token === ZERO_ADDRESS) {
    return [allow(routerAddress), call(routerAddress, UNIVERSAL_ROUTER_EXECUTE + executeArgs.slice(2), BigInt(amountIn))];
  }
  const permitArgs = coder.encode(["address", "address", "uint160", "uint48"], [token, routerAddress, amountIn, deadline]);
  const clearPermit = coder.encode(["address", "address", "uint160", "uint48"], [token, routerAddress, 0, 0]);
  return [
    allow(permit2Address),
    allow(routerAddress),
    approve(token, permit2Address, amountIn),
    call(permit2Address, PERMIT2_APPROVE + permitArgs.slice(2)),
    call(routerAddress, UNIVERSAL_ROUTER_EXECUTE + executeArgs.slice(2)),
    call(permit2Address, PERMIT2_APPROVE + clearPermit.slice(2)),
    approve(token, permit2Address, 0n),
  ];
}

export function morphoSupplySteps({
  morpho,
  market,
  assets,
  account,
}: {
  morpho: string;
  market: typeof mainnet.morphoUsdgBspy;
  assets: bigint;
  account: string;
}): Step[] {
  const args = coder.encode(
    ["tuple(address,address,address,address,uint256)", "uint256", "uint256", "address", "bytes"],
    [[market.loanToken, market.collateralToken, market.oracle, market.irm, market.lltv], assets, 0, getAddress(account), "0x"],
  );
  return allowAndCall({
    target: morpho,
    token: market.loanToken,
    amount: assets,
    data: MORPHO_SUPPLY + args.slice(2),
  });
}

export function morphoWithdrawSteps({
  morpho,
  market,
  assets,
  shares = 0n,
  account,
}: {
  morpho: string;
  market: typeof mainnet.morphoUsdgBspy;
  assets: bigint;
  shares?: bigint;
  account: string;
}): Step[] {
  // Morpho: assets>0 sizes the exit; otherwise shares are burned. Full exits must use shares.
  const useShares = shares > 0n;
  const args = coder.encode(
    ["tuple(address,address,address,address,uint256)", "uint256", "uint256", "address", "address"],
    [
      [market.loanToken, market.collateralToken, market.oracle, market.irm, market.lltv],
      useShares ? 0n : assets,
      useShares ? shares : 0n,
      getAddress(account),
      getAddress(account),
    ],
  );
  return allowAndCall({
    target: morpho,
    data: MORPHO_WITHDRAW + args.slice(2),
  });
}

export function steakhouseDepositSteps({
  vault,
  asset,
  assets,
  account,
}: {
  vault: string;
  asset: string;
  assets: bigint;
  account: string;
}): Step[] {
  const args = coder.encode(["uint256", "address"], [assets, getAddress(account)]);
  return allowAndCall({
    target: vault,
    token: asset,
    amount: assets,
    data: STEAKHOUSE_DEPOSIT + args.slice(2),
  });
}

export function steakhouseWithdrawSteps({
  vault,
  assets,
  account,
}: {
  vault: string;
  assets: bigint;
  account: string;
}): Step[] {
  const args = coder.encode(["uint256", "address", "address"], [assets, getAddress(account), getAddress(account)]);
  return allowAndCall({
    target: vault,
    data: STEAKHOUSE_WITHDRAW + args.slice(2),
  });
}

function measuredNet(amount: bigint) {
  return (BigInt(amount) * 10000n) / (10000n + DEFI_FEE_BPS);
}

export function ponsCurveBuySteps({
  curve,
  pairToken,
  amount,
  minTokensOut,
  account,
}: {
  curve: string;
  pairToken: string;
  amount: bigint;
  minTokensOut: bigint;
  account: string;
}): Step[] {
  const native = !pairToken || getAddress(pairToken) === ZERO_ADDRESS;
  const quoteIn = native ? BigInt(amount) - defiFee(amount) : measuredNet(amount);
  const data = PONS_CURVE_BUY + coder.encode(["uint256", "uint256", "address"], [quoteIn, minTokensOut, getAddress(account)]).slice(2);
  if (native) return [allow(curve), call(curve, data, BigInt(amount))];
  return allowAndCall({ target: curve, token: pairToken, amount: quoteIn, data });
}

export function ponsCurveSellSteps({
  curve,
  token,
  amount,
  minQuoteOut,
  account,
}: {
  curve: string;
  token: string;
  amount: bigint;
  minQuoteOut: bigint;
  account: string;
}): Step[] {
  const tokensIn = measuredNet(amount);
  const data = PONS_CURVE_SELL + coder.encode(["uint256", "uint256", "address"], [tokensIn, minQuoteOut, getAddress(account)]).slice(2);
  return allowAndCall({ target: curve, token, amount: tokensIn, data });
}
