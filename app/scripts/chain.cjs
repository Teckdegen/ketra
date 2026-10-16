const fs = require("fs");
const path = require("path");

// Prefer the vendored copy shipped with the app (Vercel). Fall back to the monorepo protocol folder locally.
const vendored = path.join(__dirname, "..", "vendor", "protocol");
const monorepo = path.join(__dirname, "..", "..", "protocol");
const PROTOCOL = fs.existsSync(path.join(vendored, "js", "prepare.js")) ? vendored : monorepo;

function loadEthers() {
  try {
    return require("ethers");
  } catch {
    return require(path.join(monorepo, "node_modules", "ethers"));
  }
}

const ethers = loadEthers();

const RPC = process.env.KETRA_RPC || "https://rpc.mainnet.chain.robinhood.com";
const CHAIN_ID = Number(process.env.KETRA_CHAIN_ID || 4663);
const LEGACY_FACTORY = "0x72FEE9b929eCdCd7517888ce3305614B4722808c";

function deployment() {
  const file = path.join(PROTOCOL, "deployments", "robinhood.json");
  if (!fs.existsSync(file)) return null;
  const deployed = JSON.parse(fs.readFileSync(file, "utf8"));
  return deployed.chainId === CHAIN_ID && deployed.factory ? deployed : null;
}

function factoryAddress() {
  if (process.env.KETRA_FACTORY) return ethers.getAddress(process.env.KETRA_FACTORY);
  const deployed = deployment();
  return deployed ? ethers.getAddress(deployed.factory) : LEGACY_FACTORY;
}

function factoryBlock() {
  if (process.env.KETRA_FACTORY) return Number(process.env.KETRA_FACTORY_BLOCK || 0);
  return Number(deployment()?.block || 0);
}

function envValue(name) {
  if (process.env[name]) return process.env[name].trim();
  const file = path.join(monorepo, ".env");
  if (!fs.existsSync(file)) return "";
  const line = fs.readFileSync(file, "utf8").split(/\r?\n/).find((row) => row.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, "") : "";
}

function gasKey() {
  let value = envValue("PRIVATE_KEY");
  if (/^[0-9a-fA-F]{64}$/.test(value)) value = `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error("The gas payer is not configured.");
  return value;
}

function provider() {
  return new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
}

function deployed(code) {
  return typeof code === "string" && code !== "0x";
}

function safeError(error, fallback) {
  const text = String(error?.shortMessage || error?.reason || error?.message || fallback);
  if (/gas payer is not configured|PRIVATE_KEY/i.test(text)) return "The gas payer is not configured on the server.";
  if (/insufficient funds|needs more ETH/i.test(text)) return text.replace(/0x[0-9a-fA-F]{64}/g, (match) => match).slice(0, 180);
  if (/Cannot find module|MODULE_NOT_FOUND|internal\/modules\/cjs\/loader/i.test(text)) {
    return "The wallet server is missing a dependency. Redeploy the app.";
  }
  return text.replace(/0x[0-9a-fA-F]{64}/g, "0x").slice(0, 180);
}

module.exports = { PROTOCOL, ethers, RPC, CHAIN_ID, factoryAddress, factoryBlock, gasKey, provider, deployed, safeError };
