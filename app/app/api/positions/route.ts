import { allow } from "@/lib/limit";
import { positionsFor } from "@/lib/positions";
import { isAddress } from "@/lib/tokens";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { account?: string } | null;
    const account = body?.account ?? "";
    if (!isAddress(account)) return Response.json({ positions: [], error: "No account." }, { status: 400 });
    if (!allow("positions", request, 40, 60 * 1000)) {
      return Response.json({ positions: [], error: "Too many requests." }, { status: 429 });
    }
    const positions = await positionsFor(account);
    return Response.json({ positions });
  } catch (error) {
    return Response.json(
      { positions: [], error: error instanceof Error ? error.message : "Positions could not be read." },
      { status: 502 },
    );
  }
}
