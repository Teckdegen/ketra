"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Welcome from "../welcome";
import { hasDeviceWallet, readWallets } from "@/lib/wallets";

export default function Create() {
  const router = useRouter();

  useEffect(() => {
    readWallets();
    if (hasDeviceWallet()) router.replace("/");
  }, [router]);

  return <Welcome />;
}
