import { formatAmount, normalizeAmountInput, parseAmount } from "@/lib/amount";
import { resolveToken } from "@/lib/chain";
import { allow } from "@/lib/limit";
import { afterFee, defiFee, findRoute } from "@/lib/quote";
import { safeError } from "@/lib/server-chain";
import { prepareSpend } from "@/lib/spend-relay";
import type { PreparedSpend, SpendKind, SpendSummary } from "@/lib/spend";
import { tokenById, USDG_ADDRESS, WETH_ADDRESS } from "@/lib/tokens";

export const maxDuration = 60;

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const routeNames = { v4: "Uniswap v4", v3: "Uniswap v3", v2: "Uniswap v2", curve: "Pons bonding curve" } as const;

type Body = {
  account?: string;
  kind?: SpendKind;
  token?: string;
  to?: string;
  amount?: string;
  pay?: string;
  receive?: string;
};

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.account || !ADDRESS.test(body.account)) return bad("This wallet has no account yet.");
  if (!allow("prepare", request, 60, 60 * 1000)) return bad("Too many requests. Wait a moment.", 429);
  const amountText = normalizeAmountInput((body.amount ?? "").trim());

  let plan: Record<string, unknown>;
  let summary: SpendSummary;

  if (body.kind === "send") {
    const token = await resolveToken(body.token ?? "");
    if (!token) return bad("Pick a token to send.");
    if (!body.to || !ADDRESS.test(body.to)) return bad("Enter a valid address.");
    const amount = parseAmount(amountText, token.decimals);
    if (!amount) return bad("Enter an amount.");
    const fee = amount / 1000n;
    plan = { kind: "send", token: token.address ?? "ETH", to: body.to, amount: amount.toString() };
    summary = {
      kind: "send",
      title: "Send",
      pay: { symbol: token.symbol, logo: token.logo, amount: formatAmount(amount, token.decimals) },
      to: { label: "Recipient", address: body.to },
      fee: { amount: formatAmount(fee, token.decimals), symbol: token.symbol, rate: "0.1%" },
    };
  } else if (body.kind === "swap") {
    const [pay, receive] = await Promise.all([resolveToken(body.pay ?? ""), resolveToken(body.receive ?? "")]);
    if (!pay || !receive || pay.id === receive.id) return bad("Pick two different tokens.");
    const amount = parseAmount(amountText, pay.decimals);
    if (!amount) return bad("Enter an amount.");
    const route = await findRoute(pay, receive, amount, body.account);
    if (!route) return bad("There is no route for this swap right now.");
    if (route === "wrap") {
      const wrap = pay.id === "ETH";
      const shown = formatAmount(amount, pay.decimals);
      plan = { kind: wrap ? "wrap" : "unwrap", amount: amount.toString() };
      summary = {
        kind: "swap",
        title: wrap ? "Wrap" : "Unwrap",
        pay: { symbol: pay.symbol, logo: pay.logo, amount: shown },
        receive: { symbol: receive.symbol, logo: receive.logo, amount: shown, minimum: shown },
        to: { label: "Route", address: undefined },
        fee: { amount: "0", symbol: pay.symbol, rate: "Free" },
        route: wrap ? "WETH contract · 1 ETH = 1 WETH" : "WETH contract · 1 WETH = 1 ETH",
      };
    } else {
      const minimum = (route.amountOut * 99n) / 100n;
      plan =
        route.version === "curve"
          ? {
              kind: "curve",
              side: route.side,
              curve: route.curve,
              tokenIn: route.tokenIn,
              tokenOut: route.tokenOut,
              amountIn: amount.toString(),
              amountOutMin: minimum.toString(),
            }
          : {
              kind: "swap",
              version: route.version,
              tokenIn: route.tokenIn,
              tokenOut: route.tokenOut,
              amountIn: amount.toString(),
              amountOutMin: minimum.toString(),
              fee: route.fee,
              tick: route.tick,
              hooks: route.hooks,
              path: route.path,
              payEth: pay.id === "ETH" && route.tokenIn.toLowerCase() === WETH_ADDRESS.toLowerCase(),
              receiveEth: receive.id === "ETH" && route.tokenOut.toLowerCase() === WETH_ADDRESS.toLowerCase(),
            };
      summary = {
        kind: "swap",
        title: "Swap",
        pay: { symbol: pay.symbol, logo: pay.logo, amount: formatAmount(amount, pay.decimals) },
        receive: {
          symbol: receive.symbol,
          logo: receive.logo,
          amount: formatAmount(route.amountOut, receive.decimals),
          minimum: formatAmount(minimum, receive.decimals),
        },
        to: { label: "Route", address: undefined },
        fee: { amount: formatAmount(route.charged, pay.decimals), symbol: pay.symbol, rate: "0.5%" },
        route: `${routeNames[route.version]} · 1% max slippage`,
      };
    }
  } else if (body.kind === "morpho" || body.kind === "steakhouse") {
    const usdg = tokenById("USDG");
    if (!usdg || usdg.address !== USDG_ADDRESS) return bad("USDG is not configured.");
    const amount = parseAmount(amountText, usdg.decimals);
    if (!amount) return bad("Enter an amount.");
    plan = { kind: body.kind, amount: amount.toString() };
    summary = {
      kind: body.kind,
      title: body.kind === "morpho" ? "Supply" : "Deposit",
      pay: { symbol: usdg.symbol, logo: usdg.logo, amount: formatAmount(amount, usdg.decimals) },
      to: { label: "Into", address: undefined },
      fee: { amount: formatAmount(defiFee(amount), usdg.decimals), symbol: usdg.symbol, rate: "0.5%" },
      route: body.kind === "morpho" ? `Morpho USDG / bSPY · ${formatAmount(afterFee(amount), usdg.decimals)} USDG supplied` : `Steakhouse USDG vault · ${formatAmount(afterFee(amount), usdg.decimals)} USDG deposited`,
    };
  } else {
    return bad("This action is not supported.");
  }

  try {
    const prepared = await prepareSpend(body.account, plan);
    return Response.json({ ...prepared, summary } satisfies PreparedSpend);
  } catch (error) {
    return bad(safeError(error, "This could not be prepared."), 502);
  }
}
