import type { Metadata } from "next";
import { GetStarted } from "./start";

export const metadata: Metadata = {
  title: "Get started · Ketra",
  description: "Open the Ketra web wallet, or download the desktop app for Windows and Linux.",
};

export default function GetStartedPage() {
  return <GetStarted />;
}
