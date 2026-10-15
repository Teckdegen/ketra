import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { publicKey?: string } | null;
  const publicKey = body?.publicKey?.trim().replace(/^0x/i, "") ?? "";
  if (!/^[0-9a-fA-F]{2624}$/.test(publicKey)) return Response.json({ address: null }, { status: 400 });
  const script = path.join(process.cwd(), "scripts", "predict-account.cjs");
  try {
    const { stdout } = await exec(process.execPath, [script, publicKey], { timeout: 60000, cwd: process.cwd() });
    const parsed = JSON.parse(stdout) as { address?: string | null };
    if (!parsed.address) return Response.json({ address: null }, { status: 502 });
    return Response.json({ address: parsed.address });
  } catch {
    return Response.json({ address: null }, { status: 502 });
  }
}
