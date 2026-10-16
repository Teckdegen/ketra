export function parseAmount(value: string, decimals: number) {
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
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
