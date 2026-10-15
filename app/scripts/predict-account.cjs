const path = require("path");
const { buildBlob } = require(path.join(__dirname, "..", "..", "protocol", "js", "prepare.js"));
const { Interface, keccak256, getAddress } = require(path.join(__dirname, "..", "..", "protocol", "node_modules", "ethers"));

const FACTORY = "0xbE8dDCBc8Ca74AA8015c62A845A468BDe8dC7651";
const RPC = "https://rpc.mainnet.chain.robinhood.com";
const hex = process.argv[2] || "";

if (!/^[0-9a-fA-F]{2624}$/.test(hex)) {
  console.log(JSON.stringify({ address: null }));
  process.exit(0);
}

const factory = new Interface([
  "function predictKey(bytes32 salt, bytes runtime) view returns (address)",
  "function predictAccount(bytes32 salt, address pkBlob) view returns (address)",
]);

async function call(data) {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: FACTORY, data }, "latest"] }),
  });
  if (!response.ok) throw new Error("Robinhood did not answer.");
  const body = await response.json();
  if (!body.result || body.result === "0x") throw new Error(body.error?.message || "The factory did not return an address.");
  return body.result;
}

async function main() {
  const blob = buildBlob(Buffer.from(hex, "hex"));
  const salt = keccak256(`0x${hex}`);
  const pkBlob = getAddress(factory.decodeFunctionResult("predictKey", await call(factory.encodeFunctionData("predictKey", [salt, blob])))[0]);
  const account = getAddress(
    factory.decodeFunctionResult("predictAccount", await call(factory.encodeFunctionData("predictAccount", [salt, pkBlob])))[0],
  );
  console.log(JSON.stringify({ address: account }));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
