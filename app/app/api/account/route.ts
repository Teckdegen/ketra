import { createRequire } from "node:module";
import path from "node:path";
import { allow } from "@/lib/limit";

export const maxDuration = 60;

const require = createRequire(path.join(process.cwd(), "package.json"));

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { publicKey?: string } | null;
  const publicKey = body?.publicKey?.trim().replace(/^0x/i, "") ?? "";
  if (!/^[0-9a-fA-F]{2624}$/.test(publicKey)) return Response.json({ address: null }, { status: 400 });
  if (!allow("account", request, 5, 10 * 60 * 1000)) {
    return Response.json({ address: null, error: "Too many wallets from this connection. Try again in a few minutes." }, { status: 429 });
  }

  try {
    const { createAccount } = require("./scripts/create-account.cjs") as {
      createAccount: (key: string) => Promise<{ address: string; created: boolean }>;
    };
    const result = await createAccount(publicKey);
    if (!result.address) return Response.json({ address: null, error: "The account was not created." }, { status: 502 });
    return Response.json({ address: result.address, created: result.created });
  } catch (error) {
    const { safeError } = require("./scripts/chain.cjs") as { safeError: (error: unknown, fallback: string) => string };
    const message = safeError(error, "The account was not created.");
    return Response.json({ address: null, error: message }, { status: 502 });
  }
}
