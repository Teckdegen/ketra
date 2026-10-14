const { expect } = require("chai");
const solc = require("solc");
const { ethers } = require("hardhat");
const { createKeypair, signAuthorization } = require("../js/crypto");

const FACTORY = "0x56B17B319428392097236622f04fC2Ca43d840d0";

const PROBE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
contract Cash {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}
contract Ping {
    uint256 public n;
    function ping() external { n += 1; }
}
`;

function compileProbe() {
  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: { "Probe.sol": { content: PROBE } },
        settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
      })
    )
  );
  if (output.errors && output.errors.some((error) => error.severity === "error")) {
    throw new Error(output.errors.map((error) => error.formattedMessage).join("\n"));
  }
  const contracts = output.contracts["Probe.sol"];
  return {
    cash: { abi: contracts.Cash.abi, bytecode: "0x" + contracts.Cash.evm.bytecode.object },
    ping: { abi: contracts.Ping.abi, bytecode: "0x" + contracts.Ping.evm.bytecode.object },
  };
}

async function openAccount(factory, signer, seedByte) {
  const seed = Buffer.alloc(32, seedByte);
  const keys = await createKeypair(seed);
  const blob = "0x" + Buffer.from(keys.publicKeyBlob).toString("hex");
  const salt = ethers.id("ketra-more-" + seedByte + "-" + Date.now().toString());
  await (await factory.deployKey(salt, blob)).wait();
  const pkBlob = await factory.predictKey(salt, blob);
  await (await factory.createAccount(salt, pkBlob)).wait();
  const account = await ethers.getContractAt("KetraAccount", await factory.predictAccount(salt, pkBlob));
  return { keys, account };
}

async function authorization(account, keys, nonce, steps, attachedValue = 0n, deadlineOffset = 3600) {
  const deadline = (await ethers.provider.getBlock("latest")).timestamp + deadlineOffset;
  const message = await account.authorizationMessage(nonce, deadline, attachedValue, steps);
  const signature = await signAuthorization(ethers.getBytes(message), keys.secretKey);
  return { deadline, signature };
}

describe("Ketra on Coston2", function () {
  this.timeout(600000);

  let signer;
  let factory;
  let keys;
  let account;
  let cash;
  let ping;

  before(async function () {
    const network = await ethers.provider.getNetwork();
    if (network.chainId !== 114n) this.skip();
    [signer] = await ethers.getSigners();
    factory = await ethers.getContractAt("KetraFactory", FACTORY);
    ({ keys, account } = await openAccount(factory, signer, 8));
    console.log("account", await account.getAddress());
    const probe = compileProbe();
    cash = await new ethers.ContractFactory(probe.cash.abi, probe.cash.bytecode, signer).deploy();
    await cash.waitForDeployment();
    ping = await new ethers.ContractFactory(probe.ping.abi, probe.ping.bytecode, signer).deploy();
    await ping.waitForDeployment();
    await (await cash.mint(await account.getAddress(), 50)).wait();
    await signer.sendTransaction({ to: await account.getAddress(), value: 1000n });
  });

  it("rejects an empty batch, an expired signature, a value mismatch, and the old domain", async function () {
    const steps = [{ action: 2, payload: ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [signer.address, 1n]) }];
    const empty = await authorization(account, keys, 0n, []);
    await expect(account.execute.staticCall(0, empty.deadline, 0, [], empty.signature)).to.be.revertedWithCustomError(account, "Empty");

    const expired = await authorization(account, keys, 0n, steps, 0n, -3600);
    await expect(account.execute.staticCall(0, expired.deadline, 0, steps, expired.signature)).to.be.revertedWithCustomError(
      account,
      "Expired"
    );

    const mismatch = await authorization(account, keys, 0n, steps, 1n);
    await expect(account.execute.staticCall(0, mismatch.deadline, 1, steps, mismatch.signature)).to.be.revertedWithCustomError(
      account,
      "BadValue"
    );

    const nowhere = [
      { action: 2, payload: ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [ethers.ZeroAddress, 1n]) },
    ];
    const zero = await authorization(account, keys, 0n, nowhere);
    await expect(account.execute.staticCall(0, zero.deadline, 0, nowhere, zero.signature)).to.be.revertedWithCustomError(
      account,
      "ZeroAddress"
    );

    const unknown = [{ action: 99, payload: "0x" }];
    const badAction = await authorization(account, keys, 0n, unknown);
    await expect(account.execute.staticCall(0, badAction.deadline, 0, unknown, badAction.signature)).to.be.revertedWithCustomError(
      account,
      "BadAction"
    );

    const bare = [
      {
        action: 1,
        payload: ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "uint256", "bytes"],
          [await ping.getAddress(), 0, ping.interface.encodeFunctionData("ping")]
        ),
      },
    ];
    const unlisted = await authorization(account, keys, 0n, bare);
    await expect(account.execute.staticCall(0, unlisted.deadline, 0, bare, unlisted.signature)).to.be.revertedWithCustomError(
      account,
      "NotAllowed"
    );

    const current = await authorization(account, keys, 0n, steps);
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const types = ["bytes32", "uint256", "uint256", "address", "uint256", "uint256", "uint256", "bytes32"];
    const decoded = coder.decode(types, await account.authorizationMessage(0, current.deadline, 0, steps));
    const oldMessage = coder.encode(types, [ethers.id("QUANTUM_WALLET_V1"), decoded[1], decoded[2], decoded[3], decoded[4], decoded[5], decoded[6], decoded[7]]);
    const oldSig = await signAuthorization(ethers.getBytes(oldMessage), keys.secretKey);
    await expect(account.execute.staticCall(0, current.deadline, 0, steps, oldSig)).to.be.revertedWithCustomError(account, "BadSignature");
  });

  it("sends ETH and tokens, approves an allowlisted spender, and calls an allowlisted contract", async function () {
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const payee = ethers.Wallet.createRandom().address;
    const stranger = ethers.Wallet.createRandom().address;
    const blocked = [
      { action: 4, payload: coder.encode(["address", "address", "uint256"], [await cash.getAddress(), stranger, 1n]) },
    ];
    const blockedAuth = await authorization(account, keys, 0n, blocked);
    await expect(account.execute.staticCall(0, blockedAuth.deadline, 0, blocked, blockedAuth.signature)).to.be.revertedWithCustomError(
      account,
      "NotAllowed"
    );

    const steps = [
      { action: 9, payload: coder.encode(["address", "bool"], [signer.address, true]) },
      { action: 9, payload: coder.encode(["address", "bool"], [await ping.getAddress(), true]) },
      { action: 2, payload: coder.encode(["address", "uint256"], [payee, 400n]) },
      { action: 3, payload: coder.encode(["address", "address", "uint256"], [await cash.getAddress(), payee, 20n]) },
      { action: 4, payload: coder.encode(["address", "address", "uint256"], [await cash.getAddress(), signer.address, 15n]) },
      { action: 1, payload: coder.encode(["address", "uint256", "bytes"], [await ping.getAddress(), 0, ping.interface.encodeFunctionData("ping")]) },
    ];
    const auth = await authorization(account, keys, 0n, steps);
    const tx = await account.execute(0, auth.deadline, 0, steps, auth.signature);
    await tx.wait();
    console.log("batch", tx.hash);

    expect(await ethers.provider.getBalance(payee)).to.equal(400n);
    expect(await cash.balanceOf(payee)).to.equal(20n);
    expect(await cash.allowance(await account.getAddress(), signer.address)).to.equal(15n);
    expect(await ping.n()).to.equal(1n);
    await (await cash.transferFrom(await account.getAddress(), payee, 15)).wait();
    expect(await cash.balanceOf(payee)).to.equal(35n);
    expect(await cash.balanceOf(await account.getAddress())).to.equal(15n);

    await expect(account.execute.staticCall(0, auth.deadline, 0, steps, auth.signature)).to.be.revertedWithCustomError(account, "BadNonce");
    expect(await account.nonce()).to.equal(1n);
    expect(await account.PROTOCOL_DOMAIN()).to.equal(ethers.id("KETRA_V1"));
  });

  it("rejects a degenerate blob that was deployed outside the factory", async function () {
    const blob = "0x" + "00".repeat(20545);
    const tx = await signer.sendTransaction({ data: "0x61" + "5041" + "600e60003961" + "5041" + "6000f3" + blob.slice(2) });
    const receipt = await tx.wait();
    console.log("outside blob", receipt.contractAddress);
    await expect(factory.createAccount.staticCall(ethers.id("outside-degenerate"), receipt.contractAddress)).to.be.revertedWithCustomError(
      factory,
      "DegenerateKey"
    );
  });

  it("registers a second key on the same factory", async function () {
    const second = await openAccount(factory, signer, 9);
    expect(await second.account.PROTOCOL_DOMAIN()).to.equal(ethers.id("KETRA_V1"));
    expect(await second.account.nonce()).to.equal(0n);
    console.log("second account", await second.account.getAddress());
  });
});
