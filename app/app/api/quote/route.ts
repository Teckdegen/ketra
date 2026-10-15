import { quoteSwap } from "@/lib/quote";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { pay?: string; receive?: string; amount?: string } | null;
  if (!body?.pay || !body.receive || !body.amount) {
    return Response.json({ version: null, amountOut: null });
  }
  const quote = await quoteSwap(body.pay, body.receive, body.amount);
  return Response.json(quote);
}
