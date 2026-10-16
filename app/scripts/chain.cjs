const fs = require("fs");
const path = require("path");

const PROTOCOL = path.join(__dirname, "..", "..", "protocol");
const ethers = require(path.join(PROTOCOL, "node_modules", "ethers"));

const RPC = process.env.KETRA_RPC || "https://rpc.mainnet.chain.robinhood.com";
const CHAIN_ID = Number(process.env.KETRA_CHAIN_ID || 4663);
const LEGACY_FACTORY = "0xbE8dDCBc8Ca74AA8015c62A845A468BDe8dC7651";

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
  const file = path.join(PROTOCOL, ".env");
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
  if (/insufficient funds/i.test(text)) return "The gas payer needs more ETH on Robinhood Chain.";
  return text.replace(/0x[0-9a-fA-F]{64}/g, "0x").slice(0, 180);
}

module.exports = { PROTOCOL, ethers, RPC, CHAIN_ID, factoryAddress, factoryBlock, gasKey, provider, deployed, safeError };
