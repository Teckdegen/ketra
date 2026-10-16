/** Solid, rounded icons — bold fills with soft corners. */

type Props = { className?: string };

export function IconSend({ className = "h-6 w-6" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M4.2 10.8 19.4 4.1c.85-.37 1.67.5 1.25 1.33l-6.9 13.7c-.35.7-1.4.58-1.55-.18l-1.3-6.55-6.55-1.3c-.76-.15-.88-1.2-.18-1.55Z"
      />
      <path fill="currentColor" d="M10.2 12.9 18.1 6.6l-7.1 7.1 1.85 1.85Z" opacity="0.35" />
    </svg>
  );
}

export function IconReceive({ className = "h-6 w-6" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="2.2" fill="currentColor" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="3.5" fill="currentColor" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="3.5" fill="currentColor" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2.2" fill="currentColor" />
    </svg>
  );
}

export function IconShare({ className = "h-6 w-6" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M14.2 5.2c0-1.3 1.1-2.4 2.4-2.4s2.4 1.1 2.4 2.4-1.1 2.4-2.4 2.4c-.4 0-.8-.1-1.1-.3L10.8 10c.2.4.3.8.3 1.2s-.1.8-.3 1.2l4.7 2.7c.3-.2.7-.3 1.1-.3 1.3 0 2.4 1.1 2.4 2.4s-1.1 2.4-2.4 2.4-2.4-1.1-2.4-2.4c0-.2 0-.4.1-.6l-4.8-2.8c-.4.4-.9.6-1.5.6-1.3 0-2.4-1.1-2.4-2.4s1.1-2.4 2.4-2.4c.6 0 1.1.2 1.5.6l4.8-2.8c-.1-.2-.1-.4-.1-.6Z"
      />
    </svg>
  );
}

export function IconSwap({ className = "h-6 w-6" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M7.2 5.2h8.6l-2.2-2.2c-.4-.4-.4-1 0-1.4.4-.4 1-.4 1.4 0l4.1 4.1c.4.4.4 1 0 1.4l-4.1 4.1c-.4.4-1 .4-1.4 0-.4-.4-.4-1 0-1.4l2.2-2.2H7.2c-1.5 0-2.7 1.2-2.7 2.7v1.2c0 .6-.4 1-1 1s-1-.4-1-1V10c0-2.6 2.1-4.8 4.7-4.8Zm9.6 13.6H8.2l2.2 2.2c.4.4.4 1 0 1.4-.4.4-1 .4-1.4 0l-4.1-4.1c-.4-.4-.4-1 0-1.4l4.1-4.1c.4-.4 1-.4 1.4 0 .4.4.4 1 0 1.4l-2.2 2.2h8.6c1.5 0 2.7-1.2 2.7-2.7v-1.2c0-.6.4-1 1-1s1 .4 1 1v1.2c0 2.6-2.1 4.8-4.7 4.8Z"
      />
    </svg>
  );
}

export function IconSupply({ className = "h-6 w-6" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="currentColor" d="M4.5 17.2h15c.6 0 1 .4 1 1s-.4 1-1 1h-15c-.6 0-1-.4-1-1s.4-1 1-1Z" />
      <path
        fill="currentColor"
        d="M12 4.2c.5 0 .9.4.9.9v8.1l2.5-2.5c.4-.4 1-.4 1.4 0 .4.4.4 1 0 1.4l-4.2 4.2c-.4.4-1 .4-1.4 0L7.2 12.1c-.4-.4-.4-1 0-1.4.4-.4 1-.4 1.4 0l2.5 2.5V5.1c0-.5.4-.9.9-.9Z"
      />
    </svg>
  );
}

export function IconPortfolio({ className = "h-6 w-6" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3.2" y="3.2" width="7.6" height="7.6" rx="2.4" fill="currentColor" />
      <rect x="13.2" y="3.2" width="7.6" height="7.6" rx="2.4" fill="currentColor" />
      <rect x="3.2" y="13.2" width="7.6" height="7.6" rx="2.4" fill="currentColor" />
      <rect x="13.2" y="13.2" width="7.6" height="7.6" rx="2.4" fill="currentColor" />
    </svg>
  );
}

export function IconSettings({ className = "h-6 w-6" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M10.1 3.4h3.8c.5 0 .9.3 1 .8l.3 1.5c.4.2.8.4 1.1.7l1.5-.5c.5-.2 1 .1 1.2.5l1.9 3.3c.2.4.1.9-.3 1.2l-1.2 1c0 .3.1.6.1.9s0 .6-.1.9l1.2 1c.4.3.5.8.3 1.2l-1.9 3.3c-.2.4-.7.7-1.2.5l-1.5-.5c-.3.3-.7.5-1.1.7l-.3 1.5c-.1.5-.5.8-1 .8h-3.8c-.5 0-.9-.3-1-.8l-.3-1.5c-.4-.2-.8-.4-1.1-.7l-1.5.5c-.5.2-1-.1-1.2-.5L2.6 15c-.2-.4-.1-.9.3-1.2l1.2-1c0-.3-.1-.6-.1-.9s0-.6.1-.9l-1.2-1c-.4-.3-.5-.8-.3-1.2L4.5 5.4c.2-.4.7-.7 1.2-.5l1.5.5c.3-.3.7-.5 1.1-.7l.3-1.5c.1-.5.5-.8 1-.8ZM12 9.2A2.8 2.8 0 1 0 12 14.8 2.8 2.8 0 0 0 12 9.2Z"
      />
    </svg>
  );
}

export function BrandMark({ className = "h-14 w-14" }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/ketra.png" alt="Ketra" className={`rounded-[18px] object-cover ${className}`} />
  );
}
