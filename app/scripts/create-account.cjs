const path = require("path");
const { PROTOCOL, ethers, factoryAddress, gasKey, provider: connect, deployed, safeError } = require("./chain.cjs");
const { buildBlob } = require(path.join(PROTOCOL, "js", "prepare.js"));
const { Contract, Wallet, keccak256, getAddress } = ethers;

let payer = "";
const ABI = [
  "function predictKey(bytes32 salt, bytes runtime) view returns (address)",
  "function predictAccount(bytes32 salt, address pkBlob) view returns (address)",
  "function deployKey(bytes32 salt, bytes runtime) returns (address)",
  "function createAccount(bytes32 salt, address pkBlob) returns (address)",
];

async function main() {
  const hex = (process.argv[2] || "").replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{2624}$/.test(hex)) throw new Error("The public key is not an ML-DSA-44 key.");
  const blob = "0x" + buildBlob(Buffer.from(hex, "hex")).toString("hex");
  const salt = keccak256(`0x${hex}`);
  const provider = connect();
  const signer = new Wallet(gasKey(), provider);
  payer = signer.address;
  const factory = new Contract(factoryAddress(), ABI, signer);
  const pkBlob = getAddress(await factory.predictKey(salt, blob));
  const account = getAddress(await factory.predictAccount(salt, pkBlob));

  if (deployed(await provider.getCode(account))) {
    console.log(JSON.stringify({ address: account, created: false }));
    return;
  }
  const funds = () => new Error(`The gas payer ${signer.address} needs more ETH on Robinhood Chain.`);
  const afford = async (estimate) => {
    let gas;
    try {
      gas = await estimate();
    } catch (error) {
      if (/insufficient funds/i.test(String(error?.shortMessage || error?.message || error))) throw funds();
      throw error;
    }
    const limit = gas + gas / 5n;
    const fee = await provider.getFeeData();
    const price = fee.maxFeePerGas ?? fee.gasPrice ?? 0n;
    if ((await provider.getBalance(signer.address)) < limit * price) throw funds();
    return limit;
  };
  if (!deployed(await provider.getCode(pkBlob))) {
    try {
      const keyTx = await factory.deployKey(salt, blob, {
        gasLimit: await afford(() => factory.deployKey.estimateGas(salt, blob)),
      });
      const keyReceipt = await keyTx.wait();
      if (!keyReceipt || keyReceipt.status !== 1) throw new Error("The public key was not deployed.");
    } catch (error) {
      if (!deployed(await provider.getCode(pkBlob))) throw error;
    }
  }
  try {
    const accountTx = await factory.createAccount(salt, pkBlob, {
      gasLimit: await afford(() => factory.createAccount.estimateGas(salt, pkBlob)),
    });
    const accountReceipt = await accountTx.wait();
    if (!accountReceipt || accountReceipt.status !== 1) throw new Error("The account was not created.");
  } catch (error) {
    if (!deployed(await provider.getCode(account))) throw error;
  }
  if (!deployed(await provider.getCode(account))) throw new Error("The account was not created.");
  console.log(JSON.stringify({ address: account, created: true }));
}

main().catch((error) => {
  const text = safeError(error, "The account was not created.");
  console.error(/gas payer needs/.test(text) && payer ? `The gas payer ${payer} needs more ETH on Robinhood Chain.` : text);
  process.exit(1);
});
