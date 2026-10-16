import type { Metadata } from "next";
import { GetStarted } from "./start";

export const metadata: Metadata = {
  title: "Get started · Ketra",
  description: "Install Ketra on Chrome, or download the desktop app for macOS, Windows, and Linux.",
};

export default function GetStartedPage() {
  return <GetStarted />;
}
