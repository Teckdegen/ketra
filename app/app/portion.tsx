import { formatAmount, parseAmount } from "@/lib/amount";

export function PortionButtons({
  onAmount,
  balance,
  decimals,
  className = "",
}: {
  onAmount: (value: string) => void;
  balance: string | null;
  decimals: number;
  className?: string;
}) {
  const raw = balance ? (parseAmount(balance, decimals) ?? 0n) : 0n;
  return (
    <span className={`flex gap-1 ${className}`}>
      {[25, 50, 75, 100].map((portion) => (
        <button
          key={portion}
          type="button"
          disabled={raw === 0n}
          onClick={() => onAmount(formatAmount((raw * BigInt(portion)) / 100n, decimals))}
          className="glass-field rounded-full px-2 py-0.5 text-[12px] text-[#111] disabled:opacity-40"
        >
          {portion === 100 ? "Max" : `${portion}%`}
        </button>
      ))}
    </span>
  );
}
