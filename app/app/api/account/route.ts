import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { allow } from "@/lib/limit";

const exec = promisify(execFile);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { publicKey?: string } | null;
  const publicKey = body?.publicKey?.trim().replace(/^0x/i, "") ?? "";
  if (!/^[0-9a-fA-F]{2624}$/.test(publicKey)) return Response.json({ address: null }, { status: 400 });
  if (!allow("account", request, 5, 10 * 60 * 1000)) {
    return Response.json({ address: null, error: "Too many wallets from this connection. Try again in a few minutes." }, { status: 429 });
  }
  const script = path.join(process.cwd(), "scripts", "create-account.cjs");
  try {
    const { stdout } = await exec(process.execPath, [script, publicKey], { timeout: 180000, cwd: process.cwd() });
    const parsed = JSON.parse(stdout) as { address?: string | null };
    if (!parsed.address) return Response.json({ address: null }, { status: 502 });
    return Response.json({ address: parsed.address });
  } catch (error) {
    const stderr = error instanceof Error && "stderr" in error ? String((error as { stderr?: unknown }).stderr ?? "") : "";
    const message = stderr.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || (error instanceof Error ? error.message : "");
    const safe =
      message &&
      message.length < 180 &&
      !/0x[0-9a-fA-F]{64}/i.test(message) &&
      !/node:internal|MODULE_NOT_FOUND|Cannot find module/i.test(message)
        ? message
        : /gas payer|insufficient funds/i.test(message)
          ? message
          : "The account was not created.";
    return Response.json({ address: null, error: safe }, { status: 502 });
  }
}
