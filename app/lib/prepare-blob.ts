import { createHash } from "node:crypto";

// Builds the 20,545-byte public-key blob the on-chain verifier reads.
// Same 1,312-byte FIPS 204 ML-DSA-44 key in, same blob out.

const Q = 8380417n;
const N = 256;
const D = 13;
const K = 4;
const L = 4;
const ZETA = 1753n;
export const PK_SIZE = 1312;
export const BLOB_SIZE = 20545;

function modPow(base: bigint, exp: bigint, mod: bigint) {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

function brv8(i: number) {
  let x = i & 0xff;
  let r = 0;
  for (let b = 0; b < 8; b++) {
    r = (r << 1) | (x & 1);
    x >>= 1;
  }
  return r;
}

const ZETAS = Array.from({ length: 256 }, (_, i) => modPow(ZETA, BigInt(brv8(i)), Q));

function shake(name: "shake128" | "shake256", data: Buffer, n: number) {
  return createHash(name, { outputLength: n }).update(data).digest();
}

function ntt(input: number[]) {
  const w = input.map((c) => BigInt(c));
  let m = 0;
  for (let length = 128; length >= 1; length >>= 1) {
    for (let start = 0; start < N; start += 2 * length) {
      m += 1;
      const z = ZETAS[m]!;
      for (let j = start; j < start + length; j++) {
        const t = (z * w[j + length]!) % Q;
        w[j + length] = (w[j]! - t + Q) % Q;
        w[j] = (w[j]! + t) % Q;
      }
    }
  }
  return w.map((c) => Number(c));
}

function rejNttPoly(seed: Buffer) {
  let want = 3 * N + 96;
  for (;;) {
    const buf = shake("shake128", seed, want);
    const out: number[] = [];
    for (let i = 0; i + 3 <= buf.length && out.length < N; i += 3) {
      const v = buf[i]! | (buf[i + 1]! << 8) | ((buf[i + 2]! & 0x7f) << 16);
      if (v < 8380417) out.push(v);
    }
    if (out.length === N) return out;
    want *= 2;
  }
}

function expandA(rho: Buffer) {
  const rows: number[][][] = [];
  for (let i = 0; i < K; i++) {
    const row: number[][] = [];
    for (let j = 0; j < L; j++) {
      row.push(rejNttPoly(Buffer.concat([rho, Buffer.from([j, i])])));
    }
    rows.push(row);
  }
  return rows;
}

function pkDecode(pk: Buffer) {
  if (pk.length !== PK_SIZE) {
    throw new Error(`ML-DSA-44 public key must be ${PK_SIZE} bytes, got ${pk.length}`);
  }
  const rho = pk.subarray(0, 32);
  const t1: number[][] = [];
  let off = 32;
  for (let row = 0; row < K; row++) {
    const chunk = pk.subarray(off, off + 320);
    off += 320;
    let bits = 0n;
    for (let i = 0; i < chunk.length; i++) bits |= BigInt(chunk[i]!) << BigInt(8 * i);
    const coeffs: number[] = [];
    for (let i = 0; i < N; i++) coeffs.push(Number((bits >> BigInt(10 * i)) & 0x3ffn));
    t1.push(coeffs);
  }
  return { rho, t1 };
}

function compact32(coeffs: number[]) {
  const out = Buffer.alloc(1024);
  for (let w = 0; w < 32; w++) {
    let word = 0n;
    for (let s = 0; s < 8; s++) word |= BigInt(coeffs[8 * w + s]!) << BigInt(32 * s);
    out.write(word.toString(16).padStart(64, "0"), w * 32, 32, "hex");
  }
  return out;
}

export function buildBlob(publicKey: Buffer | Uint8Array) {
  const pk = Buffer.isBuffer(publicKey) ? publicKey : Buffer.from(publicKey);
  const { rho, t1 } = pkDecode(pk);
  const aHat = expandA(rho);
  const t1Hat = t1.map((row) => ntt(row.map((c) => Number((BigInt(c) << BigInt(D)) % Q))));
  const parts: Buffer[] = [Buffer.from([0x00]), shake("shake256", pk, 64)];
  for (let i = 0; i < K; i++) parts.push(compact32(t1Hat[i]!));
  for (let i = 0; i < K; i++) {
    for (let j = 0; j < L; j++) parts.push(compact32(aHat[i]![j]!));
  }
  const blob = Buffer.concat(parts);
  if (blob.length !== BLOB_SIZE) throw new Error(`blob length ${blob.length}`);
  return blob;
}
