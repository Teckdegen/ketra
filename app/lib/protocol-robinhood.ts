import { createRequire } from "node:module";
import path from "node:path";

type Step = [number, string];

type Robinhood = {
  mainnet: {
    weth: string;
    usdg: string;
    steakUsdg: string;
    morpho: string;
    universalRouter: string;
    permit2: string;
    swapRouter02: string;
    morphoUsdgBspy: {
      loanToken: string;
      collateralToken: string;
      oracle: string;
      irm: string;
      lltv: bigint;
    };
  };
  allow: (target: string) => Step;
  v2SwapStep: (args: {
    router: string;
    amountIn: bigint;
    amountOutMin: bigint;
    path: string[];
    deadline: number;
  }) => Step;
  v3Router02Steps: (args: {
    router: string;
    tokenIn: string;
    tokenOut: string;
    fee: number;
    account: string;
    amountIn: bigint;
    amountOutMin: bigint;
  }) => Step[];
  v4SwapSteps: (args: {
    router: string;
    permit2: string;
    pool: { currency0: string; currency1: string; fee: number; tickSpacing: number; hooks: string };
    zeroForOne: boolean;
    amountIn: bigint;
    amountOutMin: bigint;
    deadline: number;
  }) => Step[];
  morphoSupplySteps: (args: {
    morpho: string;
    market: Robinhood["mainnet"]["morphoUsdgBspy"];
    assets: bigint;
    account: string;
  }) => Step[];
  steakhouseDepositSteps: (args: {
    vault: string;
    asset: string;
    assets: bigint;
    account: string;
  }) => Step[];
  ponsCurveBuySteps: (args: {
    curve: string;
    pairToken: string;
    amount: bigint;
    minTokensOut: bigint;
    account: string;
  }) => Step[];
  ponsCurveSellSteps: (args: {
    curve: string;
    token: string;
    amount: bigint;
    minQuoteOut: bigint;
    account: string;
  }) => Step[];
};

const require = createRequire(path.join(process.cwd(), "package.json"));

/** Loads the vendored protocol robinhood helpers (shipped under app/vendor). */
export function loadRobinhood(): Robinhood {
  return require("./vendor/protocol/js/robinhood.js") as Robinhood;
}
