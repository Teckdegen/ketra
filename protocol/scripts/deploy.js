const fs = require("fs");
const hre = require("hardhat");

const F1600_CODEHASH = "0x4afb4435879cdf8e50474c7aab2bc3a679caed432550ad6dba64f509309a817b";
const F1600_RUNTIME_SIZE = 21622;

function loadHelper() {
  let raw = fs.readFileSync("helpers/f1600_170.hex", "utf8").replace(/\s+/g, "");
  if (raw.startsWith("0x") || raw.startsWith("0X")) raw = raw.slice(2);
  if (raw.length / 2 !== F1600_RUNTIME_SIZE) {
    throw new Error(`helper must be ${F1600_RUNTIME_SIZE} bytes, got ${raw.length / 2}`);
  }
  const runtime = "0x" + raw;
  if (hre.ethers.keccak256(runtime).toLowerCase() !== F1600_CODEHASH) {
    throw new Error("helpers/f1600_170.hex does not match the verifier's helper hash");
  }
  return runtime;
}

function initCode(runtime) {
  const body = runtime.slice(2);
  const len = (body.length / 2).toString(16).padStart(4, "0");
  return "0x61" + len + "600e60003961" + len + "6000f3" + body;
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  if (!signer) throw new Error("no signer: set PRIVATE_KEY for this network");

  const runtime = loadHelper();
  const tx = await signer.sendTransaction({ data: initCode(runtime) });
  const receipt = await tx.wait();
  const helper = receipt.contractAddress;
  const deployed = await hre.ethers.provider.getCode(helper);
  if (hre.ethers.keccak256(deployed).toLowerCase() !== F1600_CODEHASH) {
    throw new Error("deployed helper hash does not match");
  }

  const verifier = await (await hre.ethers.getContractFactory("MLDSA44Verifier")).deploy(helper);
  await verifier.waitForDeployment();
  const feeRecipient = process.env.FEE_ADDRESS;
  if (!feeRecipient) throw new Error("set FEE_ADDRESS to the address that receives fees");
  const feeAddress = hre.ethers.getAddress(feeRecipient);
  if (feeAddress === signer.address) throw new Error("FEE_ADDRESS must not be the gas payer");
  const factory = await (await hre.ethers.getContractFactory("KetraFactory")).deploy(
    await verifier.getAddress(),
    feeAddress
  );
  await factory.waitForDeployment();
  const factoryReceipt = await factory.deploymentTransaction().wait();

  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync(
    `deployments/${hre.network.name}.json`,
    JSON.stringify(
      {
        chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
        helper,
        verifier: await verifier.getAddress(),
        factory: await factory.getAddress(),
        block: factoryReceipt.blockNumber,
        feeRecipient: feeAddress,
      },
      null,
      2
    ) + "\n"
  );

  console.log("helper  ", helper);
  console.log("verifier", await verifier.getAddress());
  console.log("factory ", await factory.getAddress());
  console.log("gas     ", signer.address);
  console.log("fees    ", feeAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
