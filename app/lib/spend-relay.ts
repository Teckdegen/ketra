import { AbiCoder, Contract, MaxUint256, Wallet, ZeroAddress, getAddress } from "ethers";
import { deployed, gasKey, provider as connect, safeError } from "@/lib/server-chain";
import {
  allow,
  mainnet,
  morphoSupplySteps,
  ponsCurveBuySteps,
  ponsCurveSellSteps,
  steakhouseDepositSteps,
  v2SwapStep,
  v3Router02Steps,
  v4SwapSteps,
  type Step,
} from "@/lib/robinhood-steps";

const coder = AbiCoder.defaultAbiCoder();
const V2_ROUTER = getAddress("0x89e5db8b5aa49aa85ac63f691524311aeb649eba");
const WETH = mainnet.weth;

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

const REVERTS: Record<string, string> = {
  BadSignature: "The signature did not match this wallet.",
  BadNonce: "This request is out of date. Review it again.",
  Expired: "This request expired. Review it again.",
  CallFailed: "The protocol rejected this transaction. Check the balance and amount.",
  Slippage: "The price moved past the limit. Review it again.",
  NotAllowed: "That contract is not allowed for this wallet.",
  FeeUnpaid: "The balance cannot cover the fee.",
  ApprovalLeft: "An approval was left open, so this was not sent.",
};

type Plan = Record<string, unknown>;

function call(target: string, value: bigint, data: string): Step {
  return [1, coder.encode(["address", "uint256", "bytes"], [getAddress(target), value, data])];
}

function build(plan: Plan, account: string): Step[] {
  if (plan.kind === "send") {
    const to = getAddress(String(plan.to));
    const amount = BigInt(String(plan.amount));
    if (plan.token === "ETH") return [[2, coder.encode(["address", "uint256"], [to, amount])]];
    return [[3, coder.encode(["address", "address", "uint256"], [getAddress(String(plan.token)), to, amount])]];
  }
  if (plan.kind === "wrap") {
    return [allow(WETH), call(WETH, BigInt(String(plan.amount)), "0xd0e30db0")];
  }
  if (plan.kind === "unwrap") {
    return [allow(WETH), call(WETH, 0n, `0x2e1a7d4d${coder.encode(["uint256"], [BigInt(String(plan.amount))]).slice(2)}`)];
  }
  if (plan.kind === "morpho") {
    return morphoSupplySteps({
      morpho: mainnet.morpho,
      market: mainnet.morphoUsdgBspy,
      assets: BigInt(String(plan.amount)),
      account,
    });
  }
  if (plan.kind === "steakhouse") {
    return steakhouseDepositSteps({
      vault: mainnet.steakUsdg,
      asset: mainnet.usdg,
      assets: BigInt(String(plan.amount)),
      account,
    });
  }
  if (plan.kind === "curve") {
    const amount = BigInt(String(plan.amountIn));
    const amountOutMin = BigInt(String(plan.amountOutMin));
    if (plan.side === "buy") {
      return ponsCurveBuySteps({
        curve: String(plan.curve),
        pairToken: String(plan.tokenIn),
        amount,
        minTokensOut: amountOutMin,
        account,
      });
    }
    if (plan.side === "sell") {
      return ponsCurveSellSteps({
        curve: String(plan.curve),
        token: String(plan.tokenIn),
        amount,
        minQuoteOut: amountOutMin,
        account,
      });
    }
    throw new Error("There is no route for this swap.");
  }
  if (plan.kind === "swap") {
    const amountIn = BigInt(String(plan.amountIn));
    const amountOutMin = BigInt(String(plan.amountOutMin));
    const tokenIn = getAddress(String(plan.tokenIn));
    const tokenOut = getAddress(String(plan.tokenOut));
    const steps: Step[] = [];
    if (plan.payEth) {
      steps.push(allow(WETH));
      steps.push(call(WETH, amountIn, "0xd0e30db0"));
    }
    if (plan.version === "v4") {
      const [currency0, currency1] = [tokenIn, tokenOut].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
      steps.push(
        ...v4SwapSteps({
          router: mainnet.universalRouter,
          permit2: mainnet.permit2,
          pool: {
            currency0,
            currency1,
            fee: Number(plan.fee),
            tickSpacing: Number(plan.tick),
            hooks: plan.hooks ? getAddress(String(plan.hooks)) : ZeroAddress,
          },
          zeroForOne: tokenIn === currency0,
          amountIn,
          amountOutMin,
          deadline: Number(plan.deadline),
        }),
      );
    } else if (plan.version === "v3") {
      steps.push(
        ...v3Router02Steps({
          router: mainnet.swapRouter02,
          tokenIn,
          tokenOut,
          fee: Number(plan.fee),
          account,
          amountIn,
          amountOutMin,
        }),
      );
    } else if (plan.version === "v2") {
      steps.push(allow(V2_ROUTER));
      steps.push(
        v2SwapStep({
          router: V2_ROUTER,
          amountIn,
          amountOutMin,
          path: plan.path as string[],
          deadline: Number(plan.deadline),
        }),
      );
    } else {
      throw new Error("There is no route for this swap.");
    }
    if (plan.receiveEth) {
      steps.push(allow(WETH));
      steps.push(call(WETH, 0n, `0x2e1a7d4d${coder.encode(["uint256"], [MaxUint256]).slice(2)}`));
    }
    return steps;
  }
  throw new Error("This action is not supported.");
}

function readable(error: unknown) {
  const name = (error as { revert?: { name?: string } })?.revert?.name;
  if (name && REVERTS[name]) return REVERTS[name];
  return safeError(error, "This transaction was not sent.");
}

export async function prepareSpend(accountRaw: string, plan: Plan) {
  const account = getAddress(accountRaw);
  const provider = connect();
  if (!deployed(await provider.getCode(account))) throw new Error("This wallet's account is not deployed yet.");
  const contract = new Contract(account, ACCOUNT_ABI, provider);
  const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
  const steps = build({ ...plan, deadline }, account).map(([action, payload]) => ({ action, payload }));
  const nonce = await contract.nonce();
  const message = await contract.authorizationMessage(nonce, deadline, 0, steps);
  return { nonce: nonce.toString(), deadline, steps, message: String(message) };
}

export async function submitSpend(input: {
  account: string;
  nonce: string;
  deadline: number;
  steps: { action: number; payload: string }[];
  signature: string;
}) {
  const account = getAddress(input.account);
  const provider = connect();
  const signer = new Wallet(gasKey(), provider);
  const contract = new Contract(account, ACCOUNT_ABI, signer);
  const steps = input.steps.map((step) => ({ action: Number(step.action), payload: step.payload }));
  const args = [BigInt(input.nonce), BigInt(input.deadline), 0n, steps, input.signature] as const;
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
