# Registration

Ketra registers an ML-DSA-44 public key before the account will honor it. The checker in `src/verifier` is unaudited Fireblocks research code. A signature that verifies is not proof that the public key was generated honestly.

Before `deployKey`:

1. The blob must be the exact 20,545-byte output of `js/prepare.js` for one 1,312-byte ML-DSA-44 public key, and it must start with `0x00`.
2. `deployKey` and the account constructor reject a degenerate `t1`. They invert `t1hat` and require at least half of the centred lifts to exceed gamma2. A key whose `t1` is all 0, or all 1023, is rejected. The matrix `Ahat` is not recomputed on chain.

`helpers/f1600_170.hex` is pinned by hash inside the verifier. A different helper can make a signature verify for a message that was never signed.

No admin key can withdraw. There is no upgrade path.
