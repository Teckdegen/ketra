import { searchTokens } from "@/lib/chain";
import { allow } from "@/lib/limit";

export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 64);
  if (!allow("tokens", request, 90, 60 * 1000)) return Response.json({ error: "Too many requests. Wait a moment." }, { status: 429 });
  return Response.json({ tokens: await searchTokens(query) });
}
