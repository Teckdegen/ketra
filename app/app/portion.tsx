const BALANCE = 0;

export function PortionButtons({ onAmount, className = "" }: { onAmount: (value: string) => void; className?: string }) {
  return (
    <span className={`flex gap-1 ${className}`}>
      {[25, 50, 75, 100].map((portion) => (
        <button
          key={portion}
          type="button"
          onClick={() => onAmount(BALANCE === 0 ? "0" : String((BALANCE * portion) / 100))}
          className="glass-field rounded-full px-2 py-0.5 text-[12px] text-[#111]"
        >
          {portion}%
        </button>
      ))}
    </span>
  );
}
