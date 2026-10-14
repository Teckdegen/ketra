# Ketra features

Ketra is a smart-account wallet. The account contract holds the ETH and the tokens. The owner approves a spend with an ML-DSA-44 signature. A separate key pays gas and cannot move the assets.

This file is the feature list. Each feature below is in the contracts or in `js/robinhood.js`. The last section is what is not built.

The domain string on every new account is `KETRA_V1`.

## 1. The account holds the assets

`KetraAccount` is the wallet. Tokens and ETH sit on that contract address, not on the owner's key and not on the gas payer's key.

The contract can receive ETH. Spending only happens inside `execute`, after the signature checks pass.

There is no admin withdraw, no proxy, and no upgrade. No function treats `msg.sender` or `ecrecover` as the owner.

## 2. ML-DSA-44 authorizes the spend

The owner's signature is ML-DSA-44, the FIPS 204 parameter set with a 1,312-byte public key and a 2,420-byte signature. Signing runs in JavaScript through `@noble/post-quantum` (`js/crypto.js`). Verification runs in `MLDSA44Verifier`.

Only a verifier return of `true` is acceptance. `false` and a revert both stop the transaction before any token move.

The checker in `src/verifier` is the Fireblocks Labs verifier. It is unaudited. Ketra does not rewrite that arithmetic.

This is the only post-quantum part. The chain, the gas payer, the tokens, and the exchanges the account calls still use ordinary signatures.

## 3. The gas payer is not the owner

Two different keys are involved in every spend.

| Key | Algorithm | What it may do |
| --- | --- | --- |
| Gas payer | secp256k1, the chain's normal signature | Pay gas and submit the transaction. |
| Owner | ML-DSA-44 | Approve the exact batch of steps. |

Anyone who has a valid owner signature may submit it. Submitting it does not make them the owner. A forged gas-payer signature can get a transaction included. It cannot move the account's assets.

## 4. The signature covers the exact batch

The owner signs the bytes from `authorizationMessage`. Those bytes are the intent binding. They commit to the chain, this account, the nonce, the deadline, the attached ETH, and every step. A step's payload carries the action's asset, amount, and receiver, so those are committed too. The encoding uses keccak256. That is the hash inside the ML-DSA message. There is no second SHA-256 commitment, and adding one would not make the signature post-quantum. The ML-DSA signature is what does that.

```solidity
abi.encode(
    keccak256("KETRA_V1"),    // domain
    1,                        // version
    block.chainid,            // this chain
    address(this),            // this account
    nonce,
    deadline,
    attachedValue,            // ETH that must arrive with the call
    keccak256(abi.encode(steps))
)
```

`steps` is the list of actions. A token transfer's token, amount, and receiver are inside that list, so they are covered. Change any step, the nonce, the deadline, the ETH value, the account, or the chain, and the old signature no longer matches.

Pass the raw message to `signAuthorization`. Do not hash it again and do not add a context prefix. The noble signer and the on-chain verifier both use an empty FIPS 204 context (`M' = 0x00 || 0x00 || M`).

## 5. Nonce stops replay

The account stores one nonce, starting at 0. The signed nonce must equal it. After a successful `execute`, the nonce increases by one. Submitting the same signature again reverts with `BadNonce`.

If a step fails, the whole transaction reverts and the nonce stays where it was.

## 6. Expiry stops a stale signature

Every authorization has a deadline as a unix timestamp. If `block.timestamp` is past that deadline, `execute` reverts with `Expired` and nothing runs.

## 7. Attached ETH must match the signature

`attachedValue` is part of the signed message. It is usually zero. `execute` reverts with `BadValue` unless the ETH sent with the transaction equals that number. A submitter cannot attach a different amount than the owner signed.

## 8. Empty and unknown actions are rejected

A batch with no steps reverts with `Empty`. An action id other than 1 through 9 reverts with `BadAction`. Both happen before the nonce is consumed when they fail the checks, or during the step loop for a bad action id after the signature has already verified. A bad action still reverts the transaction, so the nonce is not kept.

## 9. Register a real public key

The account does not store the 1,312-byte public key raw. `js/prepare.js` expands it into a 20,545-byte blob:

| Piece | What it is |
| --- | --- |
| Seed | 32 bytes, input to key generation |
| Public key | 1,312 bytes |
| Secret key | 2,560 bytes, stays off chain |
| Signature | 2,420 bytes |
| Blob | 20,545 bytes on chain |

The blob starts with `0x00`, then `tr` (SHAKE256 of the public key), `t1hat`, and `Ahat`. It is deployed as contract code so the verifier can read it with `EXTCODECOPY`.

`KetraFactory.deployKey` and the account constructor both reject a degenerate `t1`. The check inverts `t1hat` and requires at least 512 coefficients, out of 1,024, whose centred lift is larger than gamma2 (95,232). All-zero and all-1023 keys fail this check. The verifier cannot detect them, and they are forgeable without the secret, so registration is where they die.

`Ahat` is not rebuilt on chain. The blob's matrix is trusted after the `t1` check. The SHAKE helper in `helpers/f1600_170.hex` is pinned by codehash. A different helper can make a bad signature pass.

## 10. The address is known before deployment

`predictKey(salt, blob)` and `predictAccount(salt, pkBlob)` are CREATE2. The same salt and blob always produce the same addresses. ETH can be sent to the predicted account before the contracts exist. The account can spend only after `deployKey` and `createAccount`.

A different public-key blob is a different account. The account salt is `keccak256(abi.encode(salt, pkBlob))`.

## 11. One transaction can do several steps

`execute` takes an ordered list. The owner signs the whole list. Steps run in order after the signature check. A later step sees allowlist changes made by an earlier step in the same batch.

| Id | Feature | What the owner is approving |
| --- | --- | --- |
| 9 | Allow | Turn a target on or off. The target cannot be the zero address or the account itself. |
| 2 | Send ETH | Send a wei amount to one address. |
| 3 | Send a token | ERC-20 `transfer` of an amount of one token to one address. |
| 4 | Approve | Let an allowlisted spender pull up to an amount of one token. Allowance is cleared, then set. |
| 1 | Call | Call an allowlisted contract with code. The account cannot call itself. |
| 5 | Uniswap v2 swap | `swapExactTokensForTokens`. The bought tokens come back to the account. |
| 6 | Uniswap v3 swap | Original router's `exactInputSingle`. Output comes back to the account. |
| 7 | Add v2 liquidity | Both tokens go in. The LP tokens come back to the account. |
| 8 | Remove v2 liquidity | LP tokens go in. Both underlying tokens come back to the account. |

Built-in swaps and liquidity check that the account's balance increased by at least the signed minimum. If it did not, the transaction reverts with `Slippage`.

A call or an approval of a target that is not allowlisted yet reverts with `NotAllowed`. Sending to the zero address reverts with `ZeroAddress`.

## 12. Allowlist

Generic calls and approvals do not go to arbitrary addresses. The owner signs `SET_ALLOWED` for that address first. The same signed batch may allow a contract and then call it.

The allowlist is how the account reaches a protocol that has no built-in action. The owner is still approving the exact calldata, because that calldata is inside the signed steps.

## 13. Robinhood calls

These are built in `js/robinhood.js` for Robinhood Chain, chain id 4663. Each one is an allow, an ERC-20 approve, a call, and a revoke of that approval. They are not extra action ids. The account still verifies one ML-DSA signature over the whole batch. The position, the shares, the swap output, and the Lighter margin credit are written to the Ketra account. A spender approved for the call cannot keep a leftover allowance after the batch.

| Feature | How it is built | Contract |
| --- | --- | --- |
| Uniswap v3 swap | `v3Router02Steps`. SwapRouter02 `exactInputSingle` (`0x04e45aaf`). This router's struct has no deadline. | `0xCaf681a66D020601342297493863E78C959E5cb2` |
| Uniswap v4 swap | `v4SwapSteps`. Universal Router command `0x10`, actions swap, settle, take. | `0x8876789976dEcBfCbBbe364623C63652db8C0904` |
| Permit2 allowance | Used by the v4 batch. The account approves Permit2, then Permit2 approves the router. This is an allowance, not an EOA permit signature. | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| Morpho supply | `morphoSupplySteps`. Supply the loan asset into one market. The wired market is USDG borrowed against bSPY. | `0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010` |
| Steakhouse deposit | `steakhouseDepositSteps`. ERC-4626 `deposit` into the USDG vault. Shares come back to the account. | `0xBeEff033F34C046626B8D0A041844C5d1A5409dd` |
| Lighter margin | `lighterDepositSteps`. `deposit` of USDG, asset index 3, route 0 (perps). This posts margin. It does not place an order. | `0x94bAB9693Ba2f6358507eFfcbd372b0660AFfF9d` |

Action 6 must not be aimed at Robinhood's v3 router. That action speaks the older SwapRouter. Use `v3Router02Steps`.

The v4 pool wired in `mainnet.v4WethUsdg` is the dynamic-fee WETH/USDG pool (fee flag 8388608, tick spacing 60). The account never calls `PoolManager.unlock`, because it has no unlock callback.

Morpho market parameters are fixed in `mainnet.morphoUsdgBspy`: loan USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`, collateral bSPY `0xC3ED4a5A7dB4102F4Ed37Af26ef0d3f21e2360c1`, oracle `0xac6E0472981877dcebb1527E417b5CB6133721b3`, irm `0x2BD3d5965B26B51814AC95127B2b80dD6CcC0fa1`, lltv `625000000000000000`.

## 14. What a protocol call cannot do

The account has no callback functions. These do not work as a direct call from the account:

- A Uniswap v3 pool swap that expects `uniswapV3SwapCallback`.
- A Uniswap v4 swap that starts at `PoolManager.unlock`.
- Flash loans.
- ERC-777 tokens, which call back into the sender.
- A Permit2 signature produced by an externally owned account. The allowance path in the v4 batch is the one that works.
- Lighter order placement, fills, and positions. Those stay in Lighter's engine. Ketra can post margin only.

A protocol works when it accepts a contract as the user and the whole action fits in an allowlisted approve plus call.

## 15. Reentrancy

`execute` holds a lock for the whole batch. A callee cannot re-enter `execute` on the same account.

## Where this runs

New accounts sign `KETRA_V1`. Older accounts still have `QUANTUM_WALLET_V1` baked into their bytecode. A signature from one domain fails on the other. Leave those older accounts on their original factories.

Flare Coston2 is chain id 114. Do not deploy to Flare mainnet, chain id 14.

| Contract | Address |
| --- | --- |
| SHAKE helper | `0x7C4Fe7ea8D2F5C84530789E4683eBe83D0faa7b8` |
| Verifier | `0xe4Fe0f886180365cf821E9BE84356029D5f75f6a` |
| Factory | `0x56B17B319428392097236622f04fC2Ca43d840d0` |

On this factory the tests have registered a key, spent ETH, rejected a replay, an expired signature, a value mismatch, an empty batch, a bad action, a zero address, an old-domain signature, and a degenerate key, and they have sent a token, approved a spender, and called an allowlisted contract. Those accounts used throwaway seeds.

Robinhood Chain mainnet is chain id 4663. The hardhat URL is `https://rpc.mainnet.chain.robinhood.com`. Chain id 46630 is the testnet and is not a target.

| Contract | Address |
| --- | --- |
| SHAKE helper | `0x83191b4a47bac09d4e147e74276e9961dbd7f60f` |
| Verifier | `0x52b1d5bB26Cd1bDD24AcCc72e3eEC57F0a135fD7` |
| Factory | `0xbE8dDCBc8Ca74AA8015c62A845A468BDe8dC7651` |

The Robinhood factory and verifier are deployed. No Ketra account has been created there yet, so no ML-DSA spend has happened on that chain. Uniswap and Morpho transactions that already landed were sent by the gas-payer key.

`test/Ketra.js` deploys a fresh stack and checks the domain, a spend, and degenerate-key rejection. `test/KetraCoston2.js` runs the extra checks against the Coston2 factory in the table above.

## Not in this repository

- A Solana program. The same rule would apply there: the Ed25519 fee payer only gets the instruction included, and `is_signer` is not ownership. An ML-DSA-44 signature is 2,420 bytes and a Solana transaction is 1,232 bytes, so the signature would have to be written into an account before it is verified. That buffer flow is not implemented.
- Dividend claims.
- A tokenized-stock contract. bSPY appears only as the collateral asset of the Morpho market above.
- A live Ketra account on Robinhood mainnet.

## Files

| Path | Feature it implements |
| --- | --- |
| `src/account/KetraAccount.sol` | Hold assets, verify, nonce, deadline, value, steps. |
| `src/account/T1Guard.sol` | Reject a degenerate public key. |
| `src/factory/KetraFactory.sol` | Predict and deploy the key blob and the account. |
| `src/verifier/` | ML-DSA-44 verification. |
| `js/crypto.js` | Create the key and sign the message. |
| `js/prepare.js` | Build the 20,545-byte blob. |
| `js/robinhood.js` | v3, v4, Permit2, Morpho, Steakhouse, Lighter batches. |
| `docs/SAFETY.md` | What registration does and does not prove. |
