export type SavedWallet = {
  id: string;
  seed: string;
  avatar: string;
  address: string;
};

const LIST = "ketra-wallets";
const ACTIVE = "ketra-active-wallet";
const LEGACY = "ketra-owner-seed";

function valid(value: unknown): value is SavedWallet {
  if (!value || typeof value !== "object") return false;
  const item = value as SavedWallet;
  return typeof item.id === "string" && /^[0-9a-f]{64}$/.test(item.seed) && typeof item.avatar === "string" && typeof item.address === "string";
}

function persist(wallets: SavedWallet[], activeId: string) {
  localStorage.setItem(LIST, JSON.stringify(wallets));
  const active = wallets.find((wallet) => wallet.id === activeId);
  if (active) {
    localStorage.setItem(ACTIVE, active.id);
    localStorage.setItem(LEGACY, active.seed);
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
    if (Array.isArray(parsed)) wallets = parsed.filter(valid);
  } catch {
    wallets = [];
  }
  const legacy = localStorage.getItem(LEGACY) ?? "";
  if (/^[0-9a-f]{64}$/.test(legacy) && !wallets.some((wallet) => wallet.seed === legacy)) {
    wallets.unshift({ id: crypto.randomUUID(), seed: legacy, avatar: crypto.randomUUID(), address: "" });
  }
  let activeId = localStorage.getItem(ACTIVE) ?? "";
  if (!wallets.some((wallet) => wallet.id === activeId)) activeId = wallets[0]?.id ?? "";
  persist(wallets, activeId);
  return { wallets, activeId };
}

export function addWallet(seed: string, address = "") {
  const state = readWallets();
  const existing = state.wallets.find((wallet) => wallet.seed === seed);
  if (existing) {
    if (address) existing.address = address;
    persist(state.wallets, existing.id);
    return existing;
  }
  const wallet: SavedWallet = { id: crypto.randomUUID(), seed, avatar: crypto.randomUUID(), address };
  state.wallets.push(wallet);
  persist(state.wallets, wallet.id);
  return wallet;
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
  localStorage.removeItem(LIST);
  localStorage.removeItem(ACTIVE);
  localStorage.removeItem(LEGACY);
  localStorage.removeItem("ketra-avatar-seed");
}
