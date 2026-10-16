import { allow } from "@/lib/limit";
import { runScript } from "@/lib/relay";
import type { SpendStep } from "@/lib/spend";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HEX = /^0x(?:[0-9a-fA-F]{2})*$/;

type Body = {
  account?: string;
  nonce?: string;
  deadline?: number;
  steps?: SpendStep[];
  signature?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  const steps = body?.steps;
  const valid =
    body?.account &&
    ADDRESS.test(body.account) &&
    /^\d+$/.test(body.nonce ?? "") &&
    Number.isInteger(body.deadline) &&
    Array.isArray(steps) &&
    steps.length > 0 &&
    steps.length <= 32 &&
    steps.every((step) => Number.isInteger(step.action) && typeof step.payload === "string" && HEX.test(step.payload)) &&
    typeof body.signature === "string" &&
    /^0x[0-9a-fA-F]{4840}$/.test(body.signature);
  if (!valid) return Response.json({ error: "This request is not valid." }, { status: 400 });
  if (!allow("submit", request, 10, 60 * 1000)) {
    return Response.json({ error: "Too many transactions from this connection. Wait a moment." }, { status: 429 });
  }
  try {
    const result = await runScript<{ hash: string; block: number }>("relay.cjs", { op: "submit", ...body });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "This transaction was not sent." }, { status: 502 });
  }
}
