"use strict";

// Robinhood Chain mainnet, chain id 4663.
// Uniswap addresses come from Uniswap's Robinhood v3 deployment.
// SwapRouter02 was checked on chain: factory() and WETH9() match this file.
// Every batch credits the Ketra account and revokes the token allowance it opened.

const { AbiCoder, getAddress } = require("ethers");

const coder = AbiCoder.defaultAbiCoder();

const TRANSFER_FEE_BPS = 10n;
const DEFI_FEE_BPS = 50n;

function transferFee(amount) {
  return (BigInt(amount) * TRANSFER_FEE_BPS) / 10000n;
}

function defiFee(amount) {
  return (BigInt(amount) * DEFI_FEE_BPS) / 10000n;
}

const ACTION_CALL = 1;
const ACTION_APPROVE = 4;
const ACTION_SWAP_V2 = 5;
const ACTION_SWAP_V3 = 6;
const ACTION_SET_ALLOWED = 9;

const mainnet = {
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
};

function allow(target) {
  return [ACTION_SET_ALLOWED, coder.encode(["address", "bool"], [getAddress(target), true])];
}

function approve(token, spender, amount) {
  return [ACTION_APPROVE, coder.encode(["address", "address", "uint256"], [getAddress(token), getAddress(spender), amount])];
}

function call(target, data, value = 0n) {
  return [ACTION_CALL, coder.encode(["address", "uint256", "bytes"], [getAddress(target), value, data])];
}

function v3SwapStep({ router, tokenIn, tokenOut, fee, amountIn, amountOutMin, sqrtPriceLimitX96, deadline }) {
  return [
    ACTION_SWAP_V3,
    coder.encode(
      ["address", "address", "address", "uint24", "uint256", "uint256", "uint160", "uint256"],
      [
        getAddress(router),
        getAddress(tokenIn),
        getAddress(tokenOut),
        fee,
        amountIn,
        amountOutMin,
        sqrtPriceLimitX96 || 0,
        deadline,
      ]
    ),
  ];
}

function v2SwapStep({ router, amountIn, amountOutMin, path, deadline }) {
  return [
    ACTION_SWAP_V2,
    coder.encode(
      ["address", "uint256", "uint256", "address[]", "uint256"],
      [getAddress(router), amountIn, amountOutMin, path.map(getAddress), deadline]
    ),
  ];
}

const SWAP_ROUTER_02_EXACT_INPUT = "0x04e45aaf";
const UNIVERSAL_ROUTER_EXECUTE = "0x3593564c";
const PERMIT2_APPROVE = "0x87517c45";
const MORPHO_SUPPLY = "0xa99aad89";
const STEAKHOUSE_DEPOSIT = "0x6e553f65";
const STEAKHOUSE_WITHDRAW = "0xb460af94";
const STEAKHOUSE_REDEEM = "0xba087652";
const LIGHTER_DEPOSIT = "0x8a857083";
const LIGHTER_WITHDRAW = "0xd20191bd";
const LIGHTER_CLAIM = "0x2f25807e";
const MORPHO_WITHDRAW = "0x5c2bea49";
const MORPHO_WITHDRAW_COLLATERAL = "0x8720316d";
const PONS_CURVE_BUY = "0x59a87bc1";
const PONS_CURVE_SELL = "0xd04c6983";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function v3Router02Steps({ router, tokenIn, tokenOut, fee, account, amountIn, amountOutMin, sqrtPriceLimitX96 }) {
  const args = coder.encode(
    ["tuple(address,address,uint24,address,uint256,uint256,uint160)"],
    [[getAddress(tokenIn), getAddress(tokenOut), fee, getAddress(account), amountIn, amountOutMin, sqrtPriceLimitX96 || 0]]
  );
  return allowAndCall({
    target: router,
    token: tokenIn,
    amount: amountIn,
    data: SWAP_ROUTER_02_EXACT_INPUT + args.slice(2),
  });
}

function v4SwapInput({ pool, zeroForOne, amountIn, amountOutMin }) {
  const inputCurrency = zeroForOne ? pool.currency0 : pool.currency1;
  const outputCurrency = zeroForOne ? pool.currency1 : pool.currency0;
  const actions = "0x060c0f";
  const params = [
    coder.encode(
      ["tuple(tuple(address,address,uint24,int24,address),bool,uint128,uint128,uint256,bytes)"],
      [[[pool.currency0, pool.currency1, pool.fee, pool.tickSpacing, pool.hooks], zeroForOne, amountIn, amountOutMin, 0, "0x"]]
    ),
    coder.encode(["address", "uint256"], [inputCurrency, amountIn]),
    coder.encode(["address", "uint256"], [outputCurrency, amountOutMin]),
  ];
  return coder.encode(["bytes", "bytes[]"], [actions, params]);
}

function v4SwapSteps({ router, permit2, pool, zeroForOne, amountIn, amountOutMin, deadline }) {
  const token = getAddress(zeroForOne ? pool.currency0 : pool.currency1);
  const routerAddress = getAddress(router);
  const permit2Address = getAddress(permit2);
  const executeArgs = coder.encode(["bytes", "bytes[]", "uint256"], ["0x10", [v4SwapInput({ pool, zeroForOne, amountIn, amountOutMin })], deadline]);
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
    approve(token, permit2Address, 0),
  ];
}

function morphoSupplySteps({ morpho, market, assets, account }) {
  const args = coder.encode(
    ["tuple(address,address,address,address,uint256)", "uint256", "uint256", "address", "bytes"],
    [[market.loanToken, market.collateralToken, market.oracle, market.irm, market.lltv], assets, 0, getAddress(account), "0x"]
  );
  return allowAndCall({
    target: morpho,
    token: market.loanToken,
    amount: assets,
    data: MORPHO_SUPPLY + args.slice(2),
  });
}

function morphoWithdrawSteps({ morpho, market, assets, account }) {
  const args = coder.encode(
    ["tuple(address,address,address,address,uint256)", "uint256", "uint256", "address", "address"],
    [[market.loanToken, market.collateralToken, market.oracle, market.irm, market.lltv], assets, 0, getAddress(account), getAddress(account)]
  );
  return allowAndCall({
    target: morpho,
    data: MORPHO_WITHDRAW + args.slice(2),
  });
}

function morphoWithdrawCollateralSteps({ morpho, market, assets, account }) {
  const args = coder.encode(
    ["tuple(address,address,address,address,uint256)", "uint256", "address", "address"],
    [[market.loanToken, market.collateralToken, market.oracle, market.irm, market.lltv], assets, getAddress(account), getAddress(account)]
  );
  return allowAndCall({
    target: morpho,
    data: MORPHO_WITHDRAW_COLLATERAL + args.slice(2),
  });
}

function steakhouseDepositSteps({ vault, asset, assets, account }) {
  const args = coder.encode(["uint256", "address"], [assets, getAddress(account)]);
  return allowAndCall({
    target: vault,
    token: asset,
    amount: assets,
    data: STEAKHOUSE_DEPOSIT + args.slice(2),
  });
}

function steakhouseWithdrawSteps({ vault, assets, account }) {
  const args = coder.encode(["uint256", "address", "address"], [assets, getAddress(account), getAddress(account)]);
  return allowAndCall({
    target: vault,
    data: STEAKHOUSE_WITHDRAW + args.slice(2),
  });
}

function steakhouseRedeemSteps({ vault, shares, account }) {
  const args = coder.encode(["uint256", "address", "address"], [shares, getAddress(account), getAddress(account)]);
  return allowAndCall({
    target: vault,
    data: STEAKHOUSE_REDEEM + args.slice(2),
  });
}

function lighterDepositSteps({ lighter, asset, amount, account, assetIndex, routeType }) {
  const args = coder.encode(
    ["address", "uint16", "uint8", "uint256"],
    [getAddress(account), assetIndex, routeType, amount]
  );
  return allowAndCall({
    target: lighter,
    token: asset,
    amount,
    data: LIGHTER_DEPOSIT + args.slice(2),
  });
}

function lighterWithdrawSteps({ lighter, accountIndex, assetIndex, routeType, amount }) {
  const args = coder.encode(["uint48", "uint16", "uint8", "uint64"], [accountIndex, assetIndex, routeType, amount]);
  return allowAndCall({
    target: lighter,
    data: LIGHTER_WITHDRAW + args.slice(2),
  });
}

function lighterClaimSteps({ lighter, asset, amount, account, assetIndex }) {
  const args = coder.encode(["address", "uint16", "uint128"], [getAddress(account), assetIndex, amount]);
  return allowAndCall({
    target: lighter,
    token: asset,
    amount,
    data: LIGHTER_CLAIM + args.slice(2),
  });
}

/** The most a measured call can move so that it plus its 0.5% fee, pushed afterwards, fits in amount. */
function measuredNet(amount) {
  return (BigInt(amount) * 10000n) / (10000n + DEFI_FEE_BPS);
}

// The account takes 0.5% of the ETH value before the call, and the curve requires quoteIn to equal the value it receives.
// Token fees are pushed after the call from what is left, so the curve only gets the measured net.
function ponsCurveBuySteps({ curve, pairToken, amount, minTokensOut, account }) {
  const native = !pairToken || getAddress(pairToken) === ZERO_ADDRESS;
  const quoteIn = native ? BigInt(amount) - defiFee(amount) : measuredNet(amount);
  const data = PONS_CURVE_BUY + coder.encode(["uint256", "uint256", "address"], [quoteIn, minTokensOut, getAddress(account)]).slice(2);
  if (native) return [allow(curve), call(curve, data, BigInt(amount))];
  return allowAndCall({ target: curve, token: pairToken, amount: quoteIn, data });
}

function ponsCurveSellSteps({ curve, token, amount, minQuoteOut, account }) {
  const tokensIn = measuredNet(amount);
  const data = PONS_CURVE_SELL + coder.encode(["uint256", "uint256", "address"], [tokensIn, minQuoteOut, getAddress(account)]).slice(2);
  return allowAndCall({ target: curve, token, amount: tokensIn, data });
}

function allowAndCall({ target, token, amount, data }) {
  const steps = [allow(target)];
  if (token) steps.push(approve(token, target, amount));
  steps.push(call(target, data));
  if (token) steps.push(approve(token, target, 0));
  return steps;
}

module.exports = {
  mainnet,
  TRANSFER_FEE_BPS,
  DEFI_FEE_BPS,
  transferFee,
  defiFee,
  ACTION_CALL,
  ACTION_APPROVE,
  ACTION_SWAP_V2,
  ACTION_SWAP_V3,
  ACTION_SET_ALLOWED,
  allow,
  v2SwapStep,
  v3SwapStep,
  v3Router02Steps,
  v4SwapInput,
  v4SwapSteps,
  morphoSupplySteps,
  morphoWithdrawSteps,
  morphoWithdrawCollateralSteps,
  steakhouseDepositSteps,
  steakhouseWithdrawSteps,
  steakhouseRedeemSteps,
  lighterDepositSteps,
  lighterWithdrawSteps,
  lighterClaimSteps,
  measuredNet,
  ponsCurveBuySteps,
  ponsCurveSellSteps,
  allowAndCall,
};
