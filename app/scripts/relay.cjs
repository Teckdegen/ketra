const path = require("path");
const { PROTOCOL, ethers, gasKey, provider: connect, deployed, safeError } = require("./chain.cjs");
const robinhood = require(path.join(PROTOCOL, "js", "robinhood.js"));
const { AbiCoder, Contract, Wallet, ZeroAddress, getAddress } = ethers;

const coder = AbiCoder.defaultAbiCoder();
const V2_ROUTER = getAddress("0x89e5db8b5aa49aa85ac63f691524311aeb649eba");
const WETH = robinhood.mainnet.weth;
const ACCOUNT_ABI = [
  "function nonce() view returns (uint256)",
  "function authorizationMessage(uint256 nonce, uint256 deadline, uint256 attachedValue, (uint8 action, bytes payload)[] steps) view returns (bytes)",
  "function execute(uint256 nonce, uint256 deadline, uint256 attachedValue, (uint8 action, bytes payload)[] steps, bytes signature) payable",
  "error BadSignature()",
  "error BadNonce()",
  "error Expired()",
  "error BadKey()",
  "error BadValue()",
  "error Reentrancy()",
  "error Empty()",
  "error BadAction()",
  "error NotAllowed()",
  "error CallFailed()",
  "error Slippage()",
  "error ZeroAddress()",
  "error FeeUnpaid()",
  "error ApprovalLeft()",
];
const REVERTS = {
  BadSignature: "The signature did not match this wallet.",
  BadNonce: "This request is out of date. Review it again.",
  Expired: "This request expired. Review it again.",
  CallFailed: "The protocol rejected this transaction. Check the balance and amount.",
  Slippage: "The price moved past the limit. Review it again.",
  NotAllowed: "That contract is not allowed for this wallet.",
  FeeUnpaid: "The balance cannot cover the fee.",
  ApprovalLeft: "An approval was left open, so this was not sent.",
};

function call(target, value, data) {
  return [1, coder.encode(["address", "uint256", "bytes"], [getAddress(target), value, data])];
}

function build(plan, account) {
  if (plan.kind === "send") {
    const to = getAddress(plan.to);
    const amount = BigInt(plan.amount);
    if (plan.token === "ETH") return [[2, coder.encode(["address", "uint256"], [to, amount])]];
    return [[3, coder.encode(["address", "address", "uint256"], [getAddress(plan.token), to, amount])]];
  }
  if (plan.kind === "wrap") {
    return [robinhood.allow(WETH), call(WETH, BigInt(plan.amount), "0xd0e30db0")];
  }
  if (plan.kind === "unwrap") {
    return [robinhood.allow(WETH), call(WETH, 0n, "0x2e1a7d4d" + coder.encode(["uint256"], [BigInt(plan.amount)]).slice(2))];
  }
  if (plan.kind === "morpho") {
    return robinhood.morphoSupplySteps({ morpho: robinhood.mainnet.morpho, market: robinhood.mainnet.morphoUsdgBspy, assets: BigInt(plan.amount), account });
  }
  if (plan.kind === "steakhouse") {
    return robinhood.steakhouseDepositSteps({ vault: robinhood.mainnet.steakUsdg, asset: robinhood.mainnet.usdg, assets: BigInt(plan.amount), account });
  }
  if (plan.kind === "curve") {
    const amount = BigInt(plan.amountIn);
    const amountOutMin = BigInt(plan.amountOutMin);
    if (plan.side === "buy") {
      return robinhood.ponsCurveBuySteps({ curve: plan.curve, pairToken: plan.tokenIn, amount, minTokensOut: amountOutMin, account });
    }
    if (plan.side === "sell") {
      return robinhood.ponsCurveSellSteps({ curve: plan.curve, token: plan.tokenIn, amount, minQuoteOut: amountOutMin, account });
    }
    throw new Error("There is no route for this swap.");
  }
  if (plan.kind === "swap") {
    const amountIn = BigInt(plan.amountIn);
    const amountOutMin = BigInt(plan.amountOutMin);
    const tokenIn = getAddress(plan.tokenIn);
    const tokenOut = getAddress(plan.tokenOut);
    const steps = [];
    if (plan.payEth) {
      steps.push(robinhood.allow(WETH));
      steps.push(call(WETH, amountIn, "0xd0e30db0"));
    }
    if (plan.version === "v4") {
      const [currency0, currency1] = [tokenIn, tokenOut].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
      steps.push(
        ...robinhood.v4SwapSteps({
          router: robinhood.mainnet.universalRouter,
          permit2: robinhood.mainnet.permit2,
          pool: { currency0, currency1, fee: plan.fee, tickSpacing: plan.tick, hooks: plan.hooks ? getAddress(plan.hooks) : ZeroAddress },
          zeroForOne: tokenIn === currency0,
          amountIn,
          amountOutMin,
          deadline: plan.deadline,
        })
      );
    } else if (plan.version === "v3") {
      steps.push(
        ...robinhood.v3Router02Steps({ router: robinhood.mainnet.swapRouter02, tokenIn, tokenOut, fee: plan.fee, account, amountIn, amountOutMin })
      );
    } else if (plan.version === "v2") {
      steps.push(robinhood.allow(V2_ROUTER));
      steps.push(robinhood.v2SwapStep({ router: V2_ROUTER, amountIn, amountOutMin, path: plan.path, deadline: plan.deadline }));
    } else {
      throw new Error("There is no route for this swap.");
    }
    if (plan.receiveEth) {
      steps.push(robinhood.allow(WETH));
      steps.push(call(WETH, 0n, "0x2e1a7d4d" + coder.encode(["uint256"], [ethers.MaxUint256]).slice(2)));
    }
    return steps;
  }
  throw new Error("This action is not supported.");
}

function readable(error) {
  const name = error?.revert?.name;
  if (name && REVERTS[name]) return REVERTS[name];
  return safeError(error, "This transaction was not sent.");
}

async function prepare(input) {
  const account = getAddress(input.account);
  const provider = connect();
  if (!deployed(await provider.getCode(account))) throw new Error("This wallet's account is not deployed yet.");
  const contract = new Contract(account, ACCOUNT_ABI, provider);
  const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
  const steps = build({ ...input.plan, deadline }, account).map(([action, payload]) => ({ action, payload }));
  const nonce = await contract.nonce();
  const message = await contract.authorizationMessage(nonce, deadline, 0, steps);
  return { nonce: nonce.toString(), deadline, steps, message };
}

async function submit(input) {
  const account = getAddress(input.account);
  const provider = connect();
  const signer = new Wallet(gasKey(), provider);
  const contract = new Contract(account, ACCOUNT_ABI, signer);
  const steps = input.steps.map((step) => ({ action: Number(step.action), payload: step.payload }));
  const args = [BigInt(input.nonce), BigInt(input.deadline), 0n, steps, input.signature];
  try {
    await contract.execute.staticCall(...args);
  } catch (error) {
    throw new Error(readable(error));
  }
  const gas = await contract.execute.estimateGas(...args);
  const limit = gas + gas / 5n;
  const fee = await provider.getFeeData();
  const price = fee.maxFeePerGas ?? fee.gasPrice ?? 0n;
  if ((await provider.getBalance(signer.address)) < limit * price) {
    throw new Error(`The gas payer ${signer.address} needs more ETH on Robinhood Chain.`);
  }
  const tx = await contract.execute(...args, { gasLimit: limit });
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error("The transaction reverted.");
  return { hash: tx.hash, block: receipt.blockNumber };
}

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  const input = JSON.parse(raw);
  const result = input.op === "prepare" ? await prepare(input) : input.op === "submit" ? await submit(input) : null;
  if (!result) throw new Error("Unknown request.");
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(readable(error));
  process.exit(1);
});
