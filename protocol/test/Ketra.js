const { expect } = require("chai");
const fs = require("fs");
const { ethers } = require("hardhat");
const { createKeypair, signAuthorization } = require("../js/crypto");
const { mainnet, v3Router02Steps, v4SwapSteps, morphoSupplySteps, steakhouseDepositSteps, lighterDepositSteps } = require("../js/robinhood");

const F1600_CODEHASH = "0x4afb4435879cdf8e50474c7aab2bc3a679caed432550ad6dba64f509309a817b";
const F1600_RUNTIME_SIZE = 21622;

function helperInitCode() {
  let raw = fs.readFileSync("helpers/f1600_170.hex", "utf8").replace(/\s+/g, "");
  if (raw.startsWith("0x") || raw.startsWith("0X")) raw = raw.slice(2);
  if (raw.length / 2 !== F1600_RUNTIME_SIZE) throw new Error("helper size");
  const runtime = "0x" + raw;
  if (ethers.keccak256(runtime).toLowerCase() !== F1600_CODEHASH) throw new Error("helper hash");
  const len = (raw.length / 2).toString(16).padStart(4, "0");
  return "0x61" + len + "600e60003961" + len + "6000f3" + raw;
}

async function freshFactory() {
  const [signer] = await ethers.getSigners();
  const tx = await signer.sendTransaction({ data: helperInitCode() });
  const receipt = await tx.wait();
  const verifier = await (await ethers.getContractFactory("MLDSA44Verifier")).deploy(receipt.contractAddress);
  await verifier.waitForDeployment();
  const factory = await (await ethers.getContractFactory("KetraFactory")).deploy(await verifier.getAddress());
  await factory.waitForDeployment();
  return { signer, factory };
}

describe("Ketra", function () {
  this.timeout(600000);

  let signer;
  let factory;

  before(async function () {
    const [payer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    if (network.chainId !== 31337n) {
      const balance = await ethers.provider.getBalance(payer.address);
      const gasPrice = (await ethers.provider.getFeeData()).gasPrice ?? 0n;
      const needed = 28_200_000n * gasPrice + 1000n;
      if (balance < needed) {
        throw new Error(
          "chain " + network.chainId + " balance " + ethers.formatEther(balance) + " is below " + ethers.formatEther(needed)
        );
      }
    }
    ({ signer, factory } = await freshFactory());
    console.log("factory", await factory.getAddress());
  });

  it("uses the KETRA_V1 domain, registers a real key, and spends only that signature", async function () {
    const seed = Buffer.alloc(32, 4);
    const keys = await createKeypair(seed);
    const blob = "0x" + Buffer.from(keys.publicKeyBlob).toString("hex");
    const salt = ethers.id("ketra-v1-" + Date.now().toString());
    const keyTx = await factory.deployKey(salt, blob);
    await keyTx.wait();
    const pkBlob = await factory.predictKey(salt, blob);
    const accountTx = await factory.createAccount(salt, pkBlob);
    await accountTx.wait();
    const account = await ethers.getContractAt("KetraAccount", await factory.predictAccount(salt, pkBlob));

    expect(await account.PROTOCOL_DOMAIN()).to.equal(ethers.id("KETRA_V1"));

    const payee = ethers.Wallet.createRandom().address;
    const amount = 1000n;
    await signer.sendTransaction({ to: await account.getAddress(), value: amount });
    const steps = [{ action: 2, payload: ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [payee, amount]) }];
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
    const message = await account.authorizationMessage(0, deadline, 0, steps);

    const coder = ethers.AbiCoder.defaultAbiCoder();
    const oldTypes = ["bytes32", "uint256", "uint256", "address", "uint256", "uint256", "uint256", "bytes32"];
    const decoded = coder.decode(oldTypes, message);
    const oldMessage = coder.encode(oldTypes, [
      ethers.id("QUANTUM_WALLET_V1"),
      decoded[1],
      decoded[2],
      decoded[3],
      decoded[4],
      decoded[5],
      decoded[6],
      decoded[7],
    ]);
    expect(oldMessage).to.not.equal(message);
    const oldSig = await signAuthorization(ethers.getBytes(oldMessage), keys.secretKey);
    await expect(account.execute(0, deadline, 0, steps, oldSig)).to.be.revertedWithCustomError(account, "BadSignature");

    const signature = await signAuthorization(ethers.getBytes(message), keys.secretKey);
    await (await account.execute(0, deadline, 0, steps, signature)).wait();
    expect(await ethers.provider.getBalance(payee)).to.equal(amount);
    expect(await account.nonce()).to.equal(1n);
  });

  it("rejects a degenerate public key on a fresh factory", async function () {
    const blob = "0x" + "00".repeat(20545);
    await expect(factory.deployKey(ethers.id("degenerate"), blob)).to.be.revertedWithCustomError(factory, "DegenerateKey");
  });
});

describe("Robinhood calls", function () {
  it("builds the mainnet calls", function () {
    const account = "0x0000000000000000000000000000000000000001";
    const deadline = 1_800_000_000;
    const v3 = v3Router02Steps({
      router: mainnet.swapRouter02,
      tokenIn: mainnet.weth,
      tokenOut: mainnet.usdg,
      fee: 500,
      account,
      amountIn: 1000n,
      amountOutMin: 1n,
    });
    const v4 = v4SwapSteps({
      router: mainnet.universalRouter,
      permit2: mainnet.permit2,
      pool: mainnet.v4WethUsdg,
      zeroForOne: true,
      amountIn: 1000n,
      amountOutMin: 1n,
      deadline,
    });
    const morpho = morphoSupplySteps({
      morpho: mainnet.morpho,
      market: mainnet.morphoUsdgBspy,
      assets: 1000n,
      account,
    });
    const steak = steakhouseDepositSteps({
      vault: mainnet.steakUsdg,
      asset: mainnet.usdg,
      assets: 1000n,
      account,
    });
    const lighter = lighterDepositSteps({
      lighter: mainnet.lighter,
      asset: mainnet.usdg,
      amount: 1000000n,
      account,
      assetIndex: mainnet.lighterUsdgAssetIndex,
      routeType: mainnet.lighterPerpsRoute,
    });

    const coder = ethers.AbiCoder.defaultAbiCoder();
    function callData(steps, selector) {
      const step = steps.find((item) => item[0] === 1 && coder.decode(["address", "uint256", "bytes"], item[1])[2].slice(0, 10) === selector);
      expect(step, selector).to.not.equal(undefined);
      return coder.decode(["address", "uint256", "bytes"], step[1])[2];
    }
    function revoked(steps, token, spender) {
      const last = steps.at(-1);
      expect(last[0]).to.equal(4);
      const decoded = coder.decode(["address", "address", "uint256"], last[1]);
      expect(decoded[0]).to.equal(token);
      expect(decoded[1]).to.equal(spender);
      expect(decoded[2]).to.equal(0n);
    }

    const v3Args = coder.decode(
      ["tuple(address,address,uint24,address,uint256,uint256,uint160)"],
      "0x" + callData(v3, "0x04e45aaf").slice(10)
    );
    expect(v3Args[0][3]).to.equal(account);
    revoked(v3, mainnet.weth, mainnet.swapRouter02);

    const permitCalls = v4.filter((item) => item[0] === 1 && coder.decode(["address", "uint256", "bytes"], item[1])[2].slice(0, 10) === "0x87517c45");
    expect(permitCalls.length).to.equal(2);
    const opened = coder.decode(["address", "address", "uint160", "uint48"], "0x" + coder.decode(["address", "uint256", "bytes"], permitCalls[0][1])[2].slice(10));
    const closed = coder.decode(["address", "address", "uint160", "uint48"], "0x" + coder.decode(["address", "uint256", "bytes"], permitCalls[1][1])[2].slice(10));
    expect(opened[1]).to.equal(mainnet.universalRouter);
    expect(opened[2]).to.equal(1000n);
    expect(closed[2]).to.equal(0n);
    expect(closed[3]).to.equal(0);
    revoked(v4, mainnet.weth, mainnet.permit2);
    expect(callData(v4, "0x3593564c").slice(0, 10)).to.equal("0x3593564c");

    const morphoArgs = coder.decode(
      ["tuple(address,address,address,address,uint256)", "uint256", "uint256", "address", "bytes"],
      "0x" + callData(morpho, "0xa99aad89").slice(10)
    );
    expect(morphoArgs[3]).to.equal(account);
    revoked(morpho, mainnet.usdg, mainnet.morpho);

    const steakArgs = coder.decode(["uint256", "address"], "0x" + callData(steak, "0x6e553f65").slice(10));
    expect(steakArgs[1]).to.equal(account);
    revoked(steak, mainnet.usdg, mainnet.steakUsdg);

    const lighterArgs = coder.decode(["address", "uint16", "uint8", "uint256"], "0x" + callData(lighter, "0x8a857083").slice(10));
    expect(lighterArgs[0]).to.equal(account);
    revoked(lighter, mainnet.usdg, mainnet.lighter);
  });
});
