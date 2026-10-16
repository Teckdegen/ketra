/** Keeps amount typing clean: strips junk, one dot max, and turns `.5` into `0.5`. */
export function normalizeAmountInput(value: string) {
  let next = value.replace(/,/g, "").replace(/[^\d.]/g, "");
  const dot = next.indexOf(".");
  if (dot !== -1) next = `${next.slice(0, dot + 1)}${next.slice(dot + 1).replace(/\./g, "")}`;
  if (next.startsWith(".")) next = `0${next}`;
  return next;
}

export function parseAmount(value: string, decimals: number) {
  const normalized = normalizeAmountInput(value.trim());
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const padded = fraction.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || "0");
}

export function formatAmount(value: bigint, decimals: number) {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fraction = (abs % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${fraction ? `${whole}.${fraction}` : whole.toString()}`;
}

/** Short display: up to 6 significant fraction digits, thousands separators on the whole part. */
export function displayAmount(text: string) {
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = (negative ? text.slice(1) : text).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  let shown = "";
  if (fraction) {
    const lead = fraction.match(/^0*/)?.[0].length ?? 0;
    const keep = whole === "0" ? Math.min(fraction.length, lead + 4) : Math.min(fraction.length, 4);
    shown = fraction.slice(0, keep).replace(/0+$/, "");
  }
  return `${negative ? "-" : ""}${grouped}${shown ? `.${shown}` : ""}`;
}
