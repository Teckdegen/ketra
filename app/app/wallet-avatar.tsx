"use client";

import { createAvatar } from "@dicebear/core";
import * as notionistsNeutral from "@dicebear/notionists-neutral";

export const DEFAULT_AVATAR = "ketra";

export function WalletAvatar({ seed = DEFAULT_AVATAR, className = "h-12 w-12" }: { seed?: string; className?: string }) {
  const src = createAvatar(notionistsNeutral, {
    seed,
    size: 80,
    radius: 50,
    backgroundColor: ["ffffff"],
  }).toDataUri();

  return <img src={src} alt="" className={`shrink-0 rounded-full bg-white object-cover ring-1 ring-black/10 ${className}`} />;
}
