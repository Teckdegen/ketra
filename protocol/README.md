# Ketra

Ketra is a smart-account wallet. The account holds the assets. An ML-DSA-44 signature authorizes every spend. The sender of the outer transaction pays gas and is not the owner.

The checker in `src/verifier` is the Fireblocks Labs ML-DSA-44 verifier. It is unaudited. Ketra does not replace that algorithm.

## Spend

1. The owner signs `authorizationMessage(nonce, deadline, attachedValue, steps)`. The signed bytes include the domain `KETRA_V1`.
2. Anyone may submit `execute` with that signature.
3. The account checks the deadline, the nonce, the attached ETH, and that the stored public-key blob has not changed.
4. It calls the ML-DSA verifier on that message. Anything other than success reverts before an external call.
5. It consumes the nonce, then runs the steps.

A step can send ETH, send an ERC-20, approve an allowlisted spender, swap on a Uniswap V2 router or the original Uniswap V3 router, add or remove V2 liquidity, or call an allowlisted contract. Swap and liquidity outputs return to the account. A call to a contract that is not allowlisted reverts. Allowlist changes are signed steps.

`KetraFactory.predictKey` and `predictAccount` are CREATE2. ETH can be sent to the predicted account before either contract exists. Spending starts after `deployKey` and `createAccount`.

`deployKey` accepts the 20,545-byte output of `npm run prepare:key`. It rejects a blob whose `t1` is degenerate, including all zeros and all 1023. The account constructor repeats that check. See `docs/SAFETY.md`.

Signing and blob preparation run in JavaScript through `@noble/post-quantum`.

## Robinhood Chain

Chain id 4663. `js/robinhood.js` builds the calls.

| Call | Contract |
| --- | --- |
| Uniswap v3 `exactInputSingle` | SwapRouter02 `0xCaf681a66D020601342297493863E78C959E5cb2` |
| Uniswap v4 swap | Universal Router `0x8876789976dEcBfCbBbe364623C63652db8C0904` |
| Permit2 allowance | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| Morpho supply | `0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010` |
| Steakhouse USDG deposit | `0xBeEff033F34C046626B8D0A041844C5d1A5409dd` |
| Lighter USDG margin | `0x94bAB9693Ba2f6358507eFfcbd372b0660AFfF9d` |

The v4 path approves Permit2, then Permit2 approves the router, then both allowances are revoked in the same batch. Swap output, Morpho supply, Steakhouse shares, and Lighter margin are credited to the Ketra account. The account does not take the v4 unlock callback. Lighter orders stay in Lighter's engine. The on-chain call posts margin.

The built-in v3 step speaks the original SwapRouter. Robinhood's router is SwapRouter02, so use `v3Router02Steps`.

## Develop

```bash
npm install
copy .env.example .env
npm run prepare:key
npm run compile
npm run deploy
```

`PRIVATE_KEY` in `.env` is the gas payer. It cannot spend what the account holds. `npm run deploy` publishes the SHAKE helper, `MLDSA44Verifier`, and `KetraFactory` to Robinhood Chain.

No admin key can withdraw. There is no upgrade path.
