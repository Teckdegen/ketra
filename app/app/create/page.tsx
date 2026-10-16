"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Welcome from "../welcome";
import { hasDeviceAccount, readWallets } from "@/lib/wallets";

export default function Create() {
  const router = useRouter();

  useEffect(() => {
    readWallets();
    if (hasDeviceAccount()) router.replace("/");
  }, [router]);

  return <Welcome />;
}
