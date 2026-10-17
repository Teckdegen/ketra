import type { Metadata } from "next";
import { GetStarted } from "./start";

export const metadata: Metadata = {
  title: "Get started · Ketra",
  description: "Open the Ketra web wallet, or download Windows, Linux, and the Android APK.",
};

export default function GetStartedPage() {
  return <GetStarted />;
}
