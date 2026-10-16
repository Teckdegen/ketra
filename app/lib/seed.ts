import { entropyToMnemonic, generateMnemonic, mnemonicToEntropy } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { sha256 } from "@noble/hashes/sha2.js";

export function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(value: string) {
  const out = new Uint8Array(value.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function newSeedPhrase() {
  return generateMnemonic(wordlist, 128);
}

export function phraseFromSeed(seedHex: string) {
  return entropyToMnemonic(hexToBytes(seedHex), wordlist);
}

export function seedFromPhrase(value: string): { seed: string; phrase: string } | { error: string } {
  const compact = value.trim().replace(/^0x/i, "").replace(/\s+/g, "");
  if (/^[0-9a-fA-F]{64}$/.test(compact)) return { seed: compact.toLowerCase(), phrase: "" };
  const words = value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length !== 12 && words.length !== 24) return { error: "Use a 12-word seed phrase." };
  try {
    const entropy = mnemonicToEntropy(words.join(" "), wordlist);
    const phrase = words.join(" ");
    if (entropy.length === 16) return { seed: bytesToHex(sha256(entropy)), phrase };
    if (entropy.length === 32) return { seed: bytesToHex(entropy), phrase };
    return { error: "Use a 12-word seed phrase." };
  } catch {
    return { error: "That seed phrase is not valid." };
  }
}
