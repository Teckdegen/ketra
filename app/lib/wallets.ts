import { createLock, endSession, hasLock, openSecret, seal, sessionLocked, unlock } from "@/lib/lock";

export type SavedWallet = {
  id: string;
  seed: string;
  phrase?: string;
  secret?: string;
  avatar: string;
  address: string;
};

const LIST = "ketra-wallets";
const ACTIVE = "ketra-active-wallet";
const LEGACY = "ketra-owner-seed";
const memory = new Map<string, { seed: string; phrase: string }>();

function pack(seed: string, phrase: string) {
  return phrase ? JSON.stringify({ seed, phrase }) : seed;
}

function unpack(plain: string) {
  if (plain.startsWith("{")) {
    try {
      const body = JSON.parse(plain) as { seed?: string; phrase?: string };
      if (body.seed && /^[0-9a-f]{64}$/.test(body.seed)) return { seed: body.seed, phrase: body.phrase || "" };
    } catch {
      /* older wallets stored the seed on its own */
    }
  }
  return { seed: plain, phrase: "" };
}

function valid(value: unknown): value is SavedWallet {
  if (!value || typeof value !== "object") return false;
  const item = value as SavedWallet;
  const seedOk = typeof item.seed === "string" && (/^[0-9a-f]{64}$/.test(item.seed) || item.seed === "");
  const secretOk = typeof item.secret === "string" && /^[0-9a-f]{24,}$/.test(item.secret);
  const phraseOk = item.phrase === undefined || typeof item.phrase === "string";
  if (!seedOk || !phraseOk || (!/^[0-9a-f]{64}$/.test(item.seed) && !secretOk)) return false;
  return typeof item.id === "string" && typeof item.avatar === "string" && typeof item.address === "string";
}

function persist(wallets: SavedWallet[], activeId: string) {
  const stored = wallets.map((wallet) => {
    if (wallet.seed) memory.set(wallet.id, { seed: wallet.seed, phrase: wallet.phrase || "" });
    if (wallet.secret) return { id: wallet.id, seed: "", secret: wallet.secret, avatar: wallet.avatar, address: wallet.address };
    return { id: wallet.id, seed: wallet.seed, phrase: wallet.phrase || "", avatar: wallet.avatar, address: wallet.address };
  });
  localStorage.setItem(LIST, JSON.stringify(stored));
  const active = wallets.find((wallet) => wallet.id === activeId);
  if (active) {
    localStorage.setItem(ACTIVE, active.id);
    if (active.secret || hasLock()) localStorage.removeItem(LEGACY);
    else localStorage.setItem(LEGACY, active.seed);
  } else {
    localStorage.removeItem(ACTIVE);
    localStorage.removeItem(LEGACY);
  }
}

export function readWallets() {
  const raw = localStorage.getItem(LIST);
  let wallets: SavedWallet[] = [];
  try {
    const parsed = JSON.parse(raw || "[]") as unknown;
    if (Array.isArray(parsed)) {
      wallets = parsed.filter(valid).map((wallet) => {
        const open = memory.get(wallet.id);
        return { ...wallet, seed: open?.seed || wallet.seed, phrase: open?.phrase || wallet.phrase || "" };
      });
    }
  } catch {
    wallets = [];
  }
  const legacy = localStorage.getItem(LEGACY) ?? "";
  if (!hasLock() && /^[0-9a-f]{64}$/.test(legacy) && !wallets.some((wallet) => wallet.seed === legacy)) {
    wallets.unshift({ id: crypto.randomUUID(), seed: legacy, avatar: crypto.randomUUID(), address: "" });
  }
  let activeId = localStorage.getItem(ACTIVE) ?? "";
  if (!wallets.some((wallet) => wallet.id === activeId)) activeId = wallets[0]?.id ?? "";
  persist(wallets, activeId);
  return { wallets, activeId };
}

export async function hydrateSeeds() {
  const state = readWallets();
  for (const wallet of state.wallets) {
    if (!wallet.secret || wallet.seed) continue;
    const open = unpack(await openSecret(wallet.secret));
    wallet.seed = open.seed;
    wallet.phrase = open.phrase;
    if (wallet.seed) memory.set(wallet.id, open);
  }
  return state;
}

export async function addWallet(seed: string, address = "", phrase = "") {
  const state = readWallets();
  const existing = state.wallets.find((wallet) => wallet.seed === seed);
  if (existing) {
    if (address) existing.address = address;
    if (phrase) existing.phrase = phrase;
    persist(state.wallets, existing.id);
    return existing;
  }
  const wallet: SavedWallet = { id: crypto.randomUUID(), seed, phrase, avatar: crypto.randomUUID(), address };
  if (hasLock()) wallet.secret = await seal(pack(seed, phrase));
  memory.set(wallet.id, { seed, phrase });
  state.wallets.push(wallet);
  persist(state.wallets, wallet.id);
  return wallet;
}

export function removeWallet(id: string) {
  const state = readWallets();
  const index = state.wallets.findIndex((wallet) => wallet.id === id);
  if (index < 0) return state;
  const wallets = state.wallets.filter((wallet) => wallet.id !== id);
  memory.delete(id);
  const activeId = state.activeId === id ? (wallets[index] ?? wallets[index - 1])?.id ?? "" : state.activeId;
  persist(wallets, activeId);
  return { wallets, activeId };
}

export function setActive(id: string) {
  const state = readWallets();
  if (!state.wallets.some((wallet) => wallet.id === id)) return state;
  persist(state.wallets, id);
  return { wallets: state.wallets, activeId: id };
}

export function rememberAddress(id: string, address: string) {
  const state = readWallets();
  const wallet = state.wallets.find((item) => item.id === id);
  if (!wallet) return state;
  wallet.address = address;
  persist(state.wallets, state.activeId);
  return state;
}

export function clearWallets() {
  memory.clear();
  endSession();
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("ketra-") && key !== "ketra-rail") keys.push(key);
  }
  for (const key of keys) localStorage.removeItem(key);
}

export async function protectWallets(password: string) {
  if (password.length !== 6) return "Use 6 characters.";
  const state = readWallets();
  await createLock(password);
  for (const wallet of state.wallets) {
    if (!/^[0-9a-f]{64}$/.test(wallet.seed)) continue;
    wallet.secret = await seal(pack(wallet.seed, wallet.phrase || ""));
    memory.set(wallet.id, { seed: wallet.seed, phrase: wallet.phrase || "" });
  }
  persist(state.wallets, state.activeId);
  return "";
}

export async function changePassword(current: string, next: string) {
  if (current.length !== 6 || next.length !== 6) return "Use 6 characters.";
  const ok = await unlock(current);
  if (!ok) return "Wrong password.";
  const state = await hydrateSeeds();
  await createLock(next);
  for (const wallet of state.wallets) {
    if (!/^[0-9a-f]{64}$/.test(wallet.seed)) continue;
    wallet.secret = await seal(pack(wallet.seed, wallet.phrase || ""));
    memory.set(wallet.id, { seed: wallet.seed, phrase: wallet.phrase || "" });
  }
  persist(state.wallets, state.activeId);
  return "";
}

export function lockApp() {
  endSession();
  memory.clear();
  window.dispatchEvent(new Event("ketra-lock"));
}

export { hasLock, sessionLocked, unlock };
