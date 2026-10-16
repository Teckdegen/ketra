export function money(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs === 0) return "$0.00";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  if (abs >= 1) return `${sign}$${abs.toFixed(2)}`;
  return `${sign}$${abs.toFixed(4)}`;
}

export function compact(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}${(abs / 1_000).toFixed(2)}K`;
  if (abs >= 1) return `${sign}${abs.toFixed(2)}`;
  return `${sign}${abs.toFixed(4)}`;
}

export function percent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

export function shortAddress(address: string) {
  if (!address || /^0x0{40}$/i.test(address)) return "No address";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function isoDate(seconds: number) {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

export function stamp(seconds: number) {
  const date = new Date(seconds * 1000);
  const day = date.toISOString().slice(0, 10);
  const time = date.toISOString().slice(11, 19);
  return `${day} ${time}`;
}
