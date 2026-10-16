import { allow } from "@/lib/limit";
import { createAccount, safeError } from "@/lib/create-account";

export const maxDuration = 60;

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { publicKey?: string } | null;
    const publicKey = body?.publicKey?.trim().replace(/^0x/i, "") ?? "";
    if (!/^[0-9a-fA-F]{2624}$/.test(publicKey)) {
      return json({ address: null, error: "That public key is not valid." }, 400);
    }
    if (!allow("account", request, 5, 10 * 60 * 1000)) {
      return json({ address: null, error: "Too many wallets from this connection. Try again in a few minutes." }, 429);
    }

    const result = await createAccount(publicKey);
    if (!result.address) return json({ address: null, error: "The account was not created." }, 502);
    return json({ address: result.address, created: result.created });
  } catch (error) {
    return json({ address: null, error: safeError(error, "The account was not created.") }, 502);
  }
}
