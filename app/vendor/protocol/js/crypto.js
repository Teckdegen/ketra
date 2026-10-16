"use strict";

const { buildBlob } = require("./prepare");

async function mldsa() {
  const { ml_dsa44 } = await import("@noble/post-quantum/ml-dsa.js");
  return ml_dsa44;
}

async function createKeypair(seed) {
  const ml = await mldsa();
  const wanted = ml.lengths.seed;
  if (seed != null && seed.length !== wanted) {
    throw new Error(`ML-DSA-44 seed must be ${wanted} bytes`);
  }
  const keys = seed == null ? ml.keygen() : ml.keygen(seed);
  const publicKey = Buffer.from(keys.publicKey);
  return {
    publicKey,
    secretKey: Buffer.from(keys.secretKey),
    publicKeyBlob: buildBlob(publicKey),
  };
}

async function signAuthorization(message, secretKey) {
  const ml = await mldsa();
  const msg = Buffer.isBuffer(message) ? message : Buffer.from(message);
  return Buffer.from(ml.sign(msg, secretKey));
}

module.exports = { createKeypair, signAuthorization, buildBlob };
