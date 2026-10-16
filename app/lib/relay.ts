import { spawn } from "node:child_process";
import path from "node:path";

export async function runScript<T>(name: string, input: unknown, timeout = 180000): Promise<T> {
  const script = path.join(process.cwd(), "scripts", name);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { cwd: process.cwd() });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Robinhood Chain did not answer in time."));
    }, timeout);
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", () => {
      clearTimeout(timer);
      reject(new Error("The relay could not start."));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        try {
          resolve(JSON.parse(stdout) as T);
        } catch {
          reject(new Error("The relay returned an unreadable answer."));
        }
        return;
      }
      const line = stderr.split(/\r?\n/).map((row) => row.trim()).find(Boolean);
      const safe = line && line.length < 200 && !/0x[0-9a-fA-F]{64}/.test(line) ? line : "This transaction was not sent.";
      reject(new Error(safe));
    });
    child.stdin.end(JSON.stringify(input));
  });
}
