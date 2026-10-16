import { bytesToHex, hexToBytes } from "@/lib/seed";

const LOCK = "ketra-lock";
const MARK = "ketra";

type LockRecord = { salt: string; iv: string; box: string };

let aes: CryptoKey | null = null;

function source(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function derive(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: source(salt), iterations: 120000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function hasLock() {
  return Boolean(localStorage.getItem(LOCK));
}

export function sessionLocked() {
  return hasLock() && aes === null;
}

export function endSession() {
  aes = null;
}

export async function unlock(password: string) {
  const raw = localStorage.getItem(LOCK);
  if (!raw || password.length !== 6) return false;
  let record: LockRecord;
  try {
    record = JSON.parse(raw) as LockRecord;
  } catch {
    return false;
  }
  const key = await derive(password, hexToBytes(record.salt));
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: source(hexToBytes(record.iv)) }, key, source(hexToBytes(record.box)));
    if (new TextDecoder().decode(plain) !== MARK) return false;
  } catch {
    return false;
  }
  aes = key;
  return true;
}

export async function createLock(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(password, salt);
  const box = await crypto.subtle.encrypt({ name: "AES-GCM", iv: source(iv) }, key, new TextEncoder().encode(MARK));
  const record: LockRecord = { salt: bytesToHex(salt), iv: bytesToHex(iv), box: bytesToHex(new Uint8Array(box)) };
  localStorage.setItem(LOCK, JSON.stringify(record));
  aes = key;
}

export async function seal(seed: string) {
  if (!aes) throw new Error("locked");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const box = await crypto.subtle.encrypt({ name: "AES-GCM", iv: source(iv) }, aes, new TextEncoder().encode(seed));
  return bytesToHex(iv) + bytesToHex(new Uint8Array(box));
}

export async function openSecret(secret: string) {
  if (!aes) return "";
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: source(hexToBytes(secret.slice(0, 24))) }, aes, source(hexToBytes(secret.slice(24))));
  return new TextDecoder().decode(plain);
}
