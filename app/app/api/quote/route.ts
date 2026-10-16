import { quoteSwap } from "@/lib/quote";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { pay?: string; receive?: string; amount?: string; account?: string } | null;
  if (!body?.pay || !body.receive || !body.amount) {
    return Response.json({ version: null, amountOut: null });
  }
  const account = body.account && ADDRESS.test(body.account) ? body.account : undefined;
  const quote = await quoteSwap(body.pay, body.receive, body.amount, account);
  return Response.json(quote);
}
