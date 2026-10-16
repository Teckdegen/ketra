import { getAddress, keccak256 } from "ethers";
import { buildBlob } from "@/lib/prepare-blob";
import { deployed, factoryContract, gasWallet, provider as connect, safeError } from "@/lib/server-chain";

export type CreatedAccount = { address: string; created: boolean; payer: string };

export async function createAccount(publicKey: string): Promise<CreatedAccount> {
  const hex = String(publicKey || "").replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{2624}$/.test(hex)) throw new Error("The public key is not an ML-DSA-44 key.");

  const blob = `0x${buildBlob(Buffer.from(hex, "hex")).toString("hex")}`;
  const salt = keccak256(`0x${hex}`);
  const provider = connect();
  const signer = gasWallet();
  const factory = factoryContract(signer);
  const pkBlob = getAddress(await factory.predictKey(salt, blob));
  const account = getAddress(await factory.predictAccount(salt, pkBlob));

  if (deployed(await provider.getCode(account))) {
    return { address: account, created: false, payer: signer.address };
  }

  const funds = () => new Error(`The gas payer ${signer.address} needs more ETH on Robinhood Chain.`);
  const afford = async (estimate: () => Promise<bigint>) => {
    let gas: bigint;
    try {
      gas = await estimate();
    } catch (error) {
      if (/insufficient funds/i.test(String((error as { shortMessage?: string; message?: string })?.shortMessage || (error as Error)?.message || error))) {
        throw funds();
      }
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
  return { address: account, created: true, payer: signer.address };
}

export { safeError };
