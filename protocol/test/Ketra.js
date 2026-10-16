const { expect } = require("chai");
const fs = require("fs");
const solc = require("solc");
const { ethers } = require("hardhat");
const { createKeypair, signAuthorization } = require("../js/crypto");
const { mainnet, transferFee, defiFee, v3Router02Steps, v4SwapSteps, morphoSupplySteps, morphoWithdrawSteps, steakhouseDepositSteps, steakhouseWithdrawSteps, lighterDepositSteps, lighterClaimSteps } = require("../js/robinhood");

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
contract Vault {
    Cash public cash;
    uint256 public got;
    constructor(Cash cash_) { cash = cash_; }
    function asset() external view returns (address) { return address(cash); }
    function deposit(uint256 assets, address) external returns (uint256) {
        cash.transferFrom(msg.sender, address(this), assets);
        got = assets;
        return assets;
    }
    function withdraw(uint256 assets, address receiver, address) external returns (uint256) {
        cash.transfer(receiver, assets);
        return assets;
    }
}
contract Pull {
    Cash public cash;
    constructor(Cash cash_) { cash = cash_; }
    function take(uint256 amount) external { cash.transferFrom(msg.sender, address(this), amount); }
    function give(uint256 amount) external { cash.transfer(msg.sender, amount); }
}
contract Wrap {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function deposit() external payable { balanceOf[msg.sender] += msg.value; }
    function withdraw(uint256 amount) external {
        balanceOf[msg.sender] -= amount;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok);
    }
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
}
contract Sink {
    Cash public cash;
    uint256 public got;
    constructor(Cash cash_) { cash = cash_; }
    fallback() external {
        uint256 amount;
        assembly { amount := calldataload(772) }
        got = amount;
        cash.transferFrom(msg.sender, address(this), amount);
    }
}
`;

function compileProbe() {
  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: { "Probe.sol": { content: PROBE } },
        settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] } } },
      })
    )
  );
  if (output.errors && output.errors.some((error) => error.severity === "error")) {
    throw new Error(output.errors.map((error) => error.formattedMessage).join("\n"));
  }
  const contracts = output.contracts["Probe.sol"];
  return {
    cash: { abi: contracts.Cash.abi, bytecode: "0x" + contracts.Cash.evm.bytecode.object },
    vault: { abi: contracts.Vault.abi, bytecode: "0x" + contracts.Vault.evm.bytecode.object },
    sink: { abi: contracts.Sink.abi, bytecode: "0x" + contracts.Sink.evm.bytecode.object },
    pull: { abi: contracts.Pull.abi, bytecode: "0x" + contracts.Pull.evm.bytecode.object },
    wrap: { abi: contracts.Wrap.abi, runtime: "0x" + contracts.Wrap.evm.deployedBytecode.object },
  };
}

async function freshFactory() {
  const [signer] = await ethers.getSigners();
  const tx = await signer.sendTransaction({ data: helperInitCode() });
  const receipt = await tx.wait();
  const verifier = await (await ethers.getContractFactory("MLDSA44Verifier")).deploy(receipt.contractAddress);
  await verifier.waitForDeployment();
  const feeRecipient = ethers.Wallet.createRandom().address;
  const factory = await (await ethers.getContractFactory("KetraFactory")).deploy(await verifier.getAddress(), feeRecipient);
  await factory.waitForDeployment();
  return { signer, factory, feeRecipient };
}

describe("Ketra", function () {
  this.timeout(600000);

  let signer;
  let factory;
  let feeRecipient;

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
    ({ signer, factory, feeRecipient } = await freshFactory());
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
    const accountTx = await factory.createAccount(salt, pkBlob, { gasLimit: 12_000_000 });
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
    expect(await ethers.provider.getBalance(payee)).to.equal(amount - transferFee(amount));
    expect(await ethers.provider.getBalance(feeRecipient)).to.equal(transferFee(amount));
    expect(await account.feeRecipient()).to.equal(feeRecipient);
    expect(await account.previewFee(2, 10_000)).to.equal(transferFee(10_000));
    expect(await account.previewFee(1, 10_000)).to.equal(defiFee(10_000));
    expect(await account.previewFee(4, 10_000)).to.equal(0n);
    expect(await account.nonce()).to.equal(1n);

    const probe = compileProbe();
    const cash = await new ethers.ContractFactory(probe.cash.abi, probe.cash.bytecode, signer).deploy();
    await cash.waitForDeployment();
    const vault = await new ethers.ContractFactory(probe.vault.abi, probe.vault.bytecode, signer).deploy(await cash.getAddress());
    await vault.waitForDeployment();
    const sink = await new ethers.ContractFactory(probe.sink.abi, probe.sink.bytecode, signer).deploy(await cash.getAddress());
    await sink.waitForDeployment();
    const spend = 10_000n;
    await (await cash.mint(await account.getAddress(), spend * 3n)).wait();

    const v4 = v4SwapSteps({
      router: await sink.getAddress(),
      permit2: mainnet.permit2,
      pool: { ...mainnet.v4WethUsdg, currency0: await cash.getAddress() },
      zeroForOne: true,
      amountIn: spend,
      amountOutMin: 1n,
      deadline,
    });
    const routerCall = v4.find((item) => item[0] === 1 && coder.decode(["address", "uint256", "bytes"], item[1])[2].startsWith("0x3593564c"));
    const routerData = coder.decode(["address", "uint256", "bytes"], routerCall[1])[2];
    expect((routerData.length - 2) / 2).to.equal(1124);

    const more = [
      { action: 9, payload: coder.encode(["address", "bool"], [await vault.getAddress(), true]) },
      { action: 9, payload: coder.encode(["address", "bool"], [await sink.getAddress(), true]) },
      { action: 3, payload: coder.encode(["address", "address", "uint256"], [await cash.getAddress(), payee, spend]) },
      { action: 4, payload: coder.encode(["address", "address", "uint256"], [await cash.getAddress(), await vault.getAddress(), spend]) },
      { action: 1, payload: coder.encode(["address", "uint256", "bytes"], [await vault.getAddress(), 0, vault.interface.encodeFunctionData("deposit", [spend, payee])]) },
      { action: 4, payload: coder.encode(["address", "address", "uint256"], [await cash.getAddress(), await vault.getAddress(), 0]) },
      { action: 4, payload: coder.encode(["address", "address", "uint256"], [await cash.getAddress(), await sink.getAddress(), spend]) },
      { action: 1, payload: coder.encode(["address", "uint256", "bytes"], [await sink.getAddress(), 0, routerData]) },
      { action: 4, payload: coder.encode(["address", "address", "uint256"], [await cash.getAddress(), await sink.getAddress(), 0]) },
    ];
    const again = await signAuthorization(ethers.getBytes(await account.authorizationMessage(1, deadline, 0, more)), keys.secretKey);
    await (await account.execute(1, deadline, 0, more, again)).wait();

    expect(await cash.balanceOf(payee)).to.equal(spend - transferFee(spend));
    expect(await vault.got()).to.equal(spend - defiFee(spend));
    expect(await sink.got()).to.equal(spend - defiFee(spend));
    expect(await cash.balanceOf(feeRecipient)).to.equal(transferFee(spend) + defiFee(spend) + defiFee(spend));
    expect(await cash.balanceOf(await account.getAddress())).to.equal(0n);

    const held = spend - defiFee(spend);
    const exit = [
      {
        action: 1,
        payload: coder.encode(
          ["address", "uint256", "bytes"],
          [await vault.getAddress(), 0, vault.interface.encodeFunctionData("withdraw", [held, payee, await account.getAddress()])]
        ),
      },
    ];
    const out = await signAuthorization(ethers.getBytes(await account.authorizationMessage(2, deadline, 0, exit)), keys.secretKey);
    await (await account.execute(2, deadline, 0, exit, out)).wait();
    expect(await cash.balanceOf(payee)).to.equal(spend - transferFee(spend) + held - defiFee(held));
    expect(await cash.balanceOf(feeRecipient)).to.equal(transferFee(spend) + defiFee(spend) + defiFee(spend) + defiFee(held));
    expect(await cash.balanceOf(await account.getAddress())).to.equal(0n);

    const pull = await new ethers.ContractFactory(probe.pull.abi, probe.pull.bytecode, signer).deploy(await cash.getAddress());
    await pull.waitForDeployment();
    const pullAddress = await pull.getAddress();
    const accountAddress = await account.getAddress();
    await (await cash.mint(accountAddress, spend * 2n)).wait();
    await (await cash.mint(pullAddress, spend)).wait();
    const feesBefore = await cash.balanceOf(feeRecipient);
    const measured = [
      { action: 9, payload: coder.encode(["address", "bool"], [pullAddress, true]) },
      { action: 4, payload: coder.encode(["address", "address", "uint256"], [await cash.getAddress(), pullAddress, spend]) },
      { action: 1, payload: coder.encode(["address", "uint256", "bytes"], [pullAddress, 0, pull.interface.encodeFunctionData("take", [spend])]) },
      { action: 1, payload: coder.encode(["address", "uint256", "bytes"], [pullAddress, 0, pull.interface.encodeFunctionData("give", [spend])]) },
      { action: 4, payload: coder.encode(["address", "address", "uint256"], [await cash.getAddress(), pullAddress, 0]) },
    ];
    const measuredSig = await signAuthorization(ethers.getBytes(await account.authorizationMessage(3, deadline, 0, measured)), keys.secretKey);
    await (await account.execute(3, deadline, 0, measured, measuredSig)).wait();
    expect(await cash.balanceOf(feeRecipient)).to.equal(feesBefore + defiFee(spend) + defiFee(spend));
    expect(await cash.balanceOf(accountAddress)).to.equal(spend * 2n - defiFee(spend) * 2n);

    const cashAddress = await cash.getAddress();
    const direct = [
      { action: 9, payload: coder.encode(["address", "bool"], [cashAddress, true]) },
      { action: 1, payload: coder.encode(["address", "uint256", "bytes"], [cashAddress, 0, cash.interface.encodeFunctionData("transfer", [payee, 1000n])]) },
    ];
    const payeeBefore = await cash.balanceOf(payee);
    const feesBeforeDirect = await cash.balanceOf(feeRecipient);
    const directSig = await signAuthorization(ethers.getBytes(await account.authorizationMessage(4, deadline, 0, direct)), keys.secretKey);
    await (await account.execute(4, deadline, 0, direct, directSig)).wait();
    expect(await cash.balanceOf(payee)).to.equal(payeeBefore + 1000n);
    expect(await cash.balanceOf(feeRecipient)).to.equal(feesBeforeDirect + defiFee(1000n));

    const rawApprove = [
      { action: 1, payload: coder.encode(["address", "uint256", "bytes"], [cashAddress, 0, cash.interface.encodeFunctionData("approve", [pullAddress, 1000n])]) },
    ];
    const rawSig = await signAuthorization(ethers.getBytes(await account.authorizationMessage(5, deadline, 0, rawApprove)), keys.secretKey);
    await expect(account.execute(5, deadline, 0, rawApprove, rawSig)).to.be.revertedWithCustomError(account, "BadAction");

    const leftover = [
      { action: 4, payload: coder.encode(["address", "address", "uint256"], [cashAddress, pullAddress, 1000n]) },
    ];
    const leftoverSig = await signAuthorization(ethers.getBytes(await account.authorizationMessage(5, deadline, 0, leftover)), keys.secretKey);
    await expect(account.execute(5, deadline, 0, leftover, leftoverSig)).to.be.revertedWithCustomError(account, "ApprovalLeft");

    const random = [];
    let expectedFee = 0n;
    let sent = 0n;
    for (let i = 0; i < 40; i++) {
      const value = BigInt(1 + Math.floor(Math.random() * 1_000_000));
      random.push({ action: 3, payload: coder.encode(["address", "address", "uint256"], [cashAddress, payee, value]) });
      expectedFee += transferFee(value);
      sent += value;
    }
    await (await cash.mint(accountAddress, sent)).wait();
    const heldBefore = await cash.balanceOf(accountAddress);
    const feesBeforeRandom = await cash.balanceOf(feeRecipient);
    const payeeBeforeRandom = await cash.balanceOf(payee);
    const randomSig = await signAuthorization(ethers.getBytes(await account.authorizationMessage(5, deadline, 0, random)), keys.secretKey);
    await (await account.execute(5, deadline, 0, random, randomSig)).wait();
    expect(await cash.balanceOf(feeRecipient)).to.equal(feesBeforeRandom + expectedFee);
    expect(await cash.balanceOf(payee)).to.equal(payeeBeforeRandom + sent - expectedFee);
    expect(await cash.balanceOf(accountAddress)).to.equal(heldBefore - sent);

    const wethAddress = await account.WETH();
    await ethers.provider.send("hardhat_setCode", [wethAddress, probe.wrap.runtime]);
    const weth = new ethers.Contract(wethAddress, probe.wrap.abi, signer);
    await (await weth.deposit({ value: 777_000n })).wait();
    await (await weth.transfer(accountAddress, 777_000n)).wait();
    await (await signer.sendTransaction({ to: accountAddress, value: 5_000_000n })).wait();
    const ethFeesBefore = await ethers.provider.getBalance(feeRecipient);
    const ethHeldBefore = await ethers.provider.getBalance(accountAddress);
    const wrapAll = [
      { action: 9, payload: coder.encode(["address", "bool"], [wethAddress, true]) },
      { action: 1, payload: coder.encode(["address", "uint256", "bytes"], [wethAddress, 5_000_000n, weth.interface.encodeFunctionData("deposit")]) },
      { action: 1, payload: coder.encode(["address", "uint256", "bytes"], [wethAddress, 0, weth.interface.encodeFunctionData("withdraw", [ethers.MaxUint256])]) },
      { action: 3, payload: coder.encode(["address", "address", "uint256"], [wethAddress, payee, 777_000n]) },
    ];
    const wrapSig = await signAuthorization(ethers.getBytes(await account.authorizationMessage(6, deadline, 0, wrapAll)), keys.secretKey);
    await (await account.execute(6, deadline, 0, wrapAll, wrapSig)).wait();
    expect(await weth.balanceOf(accountAddress)).to.equal(0n);
    expect(await weth.balanceOf(payee)).to.equal(777_000n - transferFee(777_000n));
    expect(await weth.balanceOf(feeRecipient)).to.equal(0n);
    expect(await ethers.provider.getBalance(feeRecipient)).to.equal(ethFeesBefore + transferFee(777_000n));
    expect(await ethers.provider.getBalance(accountAddress)).to.equal(ethHeldBefore);

    for (let i = 0; i < 2000; i++) {
      const value = BigInt(Math.floor(Math.random() * 2 ** 52)) * BigInt(1 + Math.floor(Math.random() * 1_000_000));
      expect(await account.previewFee(2, value)).to.equal(transferFee(value));
      expect(await account.previewFee(1, value)).to.equal(defiFee(value));
    }
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

    const morphoOut = morphoWithdrawSteps({
      morpho: mainnet.morpho,
      market: mainnet.morphoUsdgBspy,
      assets: 1000n,
      account,
    });
    const morphoOutArgs = coder.decode(
      ["tuple(address,address,address,address,uint256)", "uint256", "uint256", "address", "address"],
      "0x" + callData(morphoOut, "0x5c2bea49").slice(10)
    );
    expect(morphoOutArgs[4]).to.equal(account);

    const steakOut = steakhouseWithdrawSteps({ vault: mainnet.steakUsdg, assets: 1000n, account });
    const steakOutArgs = coder.decode(["uint256", "address", "address"], "0x" + callData(steakOut, "0xb460af94").slice(10));
    expect(steakOutArgs[1]).to.equal(account);
    expect(steakOutArgs[2]).to.equal(account);

    const claim = lighterClaimSteps({
      lighter: mainnet.lighter,
      asset: mainnet.usdg,
      amount: 1000n,
      account,
      assetIndex: mainnet.lighterUsdgAssetIndex,
    });
    const claimArgs = coder.decode(["address", "uint16", "uint128"], "0x" + callData(claim, "0x2f25807e").slice(10));
    expect(claimArgs[0]).to.equal(account);
    revoked(claim, mainnet.usdg, mainnet.lighter);
  });
});
