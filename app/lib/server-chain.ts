import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { Contract, JsonRpcProvider, Wallet, getAddress } from "ethers";
import deploymentFallback from "@/vendor/protocol/deployments/robinhood.json";

export const RPC = process.env.KETRA_RPC || "https://rpc.mainnet.chain.robinhood.com";
export const CHAIN_ID = Number(process.env.KETRA_CHAIN_ID || 4663);
const LEGACY_FACTORY = "0x72FEE9b929eCdCd7517888ce3305614B4722808c";

type Deployment = {
  chainId?: number;
  factory?: string;
  block?: number;
};

function deployment(): Deployment | null {
  const file = path.join(process.cwd(), "vendor", "protocol", "deployments", "robinhood.json");
  const raw = existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as Deployment)
    : (deploymentFallback as Deployment);
  return raw.chainId === CHAIN_ID && raw.factory ? raw : null;
}

export function factoryAddress() {
  if (process.env.KETRA_FACTORY) return getAddress(process.env.KETRA_FACTORY);
  const deployed = deployment();
  return deployed?.factory ? getAddress(deployed.factory) : LEGACY_FACTORY;
}

export function factoryBlock() {
  if (process.env.KETRA_FACTORY) return Number(process.env.KETRA_FACTORY_BLOCK || 0);
  return Number(deployment()?.block || 0);
}

function envValue(name: string) {
  if (process.env[name]) return process.env[name]!.trim();
  const file = path.join(process.cwd(), "..", "protocol", ".env");
  if (!existsSync(file)) return "";
  const line = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .find((row) => row.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, "") : "";
}

export function gasKey() {
  let value = envValue("PRIVATE_KEY");
  if (/^[0-9a-fA-F]{64}$/.test(value)) value = `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error("The gas payer is not configured.");
  return value;
}

export function provider() {
  return new JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
}

export function gasWallet() {
  return new Wallet(gasKey(), provider());
}

export function factoryContract(signer = gasWallet()) {
  return new Contract(
    factoryAddress(),
    [
      "function predictKey(bytes32 salt, bytes runtime) view returns (address)",
      "function predictAccount(bytes32 salt, address pkBlob) view returns (address)",
      "function deployKey(bytes32 salt, bytes runtime) returns (address)",
      "function createAccount(bytes32 salt, address pkBlob) returns (address)",
    ],
    signer,
  );
}

export function deployed(code: string) {
  return typeof code === "string" && code !== "0x";
}

export function safeError(error: unknown, fallback: string) {
  const err = error as { shortMessage?: string; reason?: string; message?: string };
  const text = String(err?.shortMessage || err?.reason || err?.message || fallback);
  if (/gas payer is not configured|PRIVATE_KEY/i.test(text)) return "The gas payer is not configured on the server.";
  if (/insufficient funds|needs more ETH/i.test(text)) return text.slice(0, 180);
  if (/Cannot find module|MODULE_NOT_FOUND|internal\/modules\/cjs\/loader/i.test(text)) {
    return "The wallet server is missing a dependency. Redeploy the app.";
  }
  if (/string did not match the expected pattern/i.test(text)) {
    return "The wallet server could not talk to Robinhood Chain. Check the RPC and try again.";
  }
  return text.replace(/0x[0-9a-fA-F]{64}/g, "0x").slice(0, 180);
}
