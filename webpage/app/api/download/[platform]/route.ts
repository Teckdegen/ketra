import { NextResponse } from "next/server";

export const maxDuration = 30;

const RELEASE = process.env.KETRA_DESKTOP_RELEASE || "v0.1.0";
const BASE = `https://github.com/Teckdegen/ketra/releases/download/${RELEASE}`;

const FILES = {
  mac: "Ketra-macOS.dmg",
  windows: "Ketra-Setup.exe",
  linux: "Ketra.deb",
  android: "Ketra.apk",
} as const;

const PUBLISHED: Record<keyof typeof FILES, boolean> = {
  mac: true,
  windows: true,
  linux: true,
  android: true,
};

type Platform = keyof typeof FILES;

function isPlatform(value: string): value is Platform {
  return value === "mac" || value === "windows" || value === "linux" || value === "android";
}

function missingMessage(platform: Platform) {
  return platform === "mac"
    ? "The macOS build is not published yet. It needs a Mac pack step."
    : "That build is not published yet.";
}

function fileUrl(platform: Platform) {
  return `${BASE}/${FILES[platform]}`;
}

/** Prefer a direct GitHub asset URL so browsers do not chain apex → www → API → GitHub. */
export async function HEAD(_request: Request, context: { params: Promise<{ platform: string }> }) {
  const { platform } = await context.params;
  if (!isPlatform(platform) || !PUBLISHED[platform]) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(fileUrl(platform), 302);
}

export async function GET(_request: Request, context: { params: Promise<{ platform: string }> }) {
  const { platform } = await context.params;
  if (!isPlatform(platform)) {
    return NextResponse.json({ error: "Unknown platform." }, { status: 404 });
  }
  if (!PUBLISHED[platform]) {
    return NextResponse.json({ error: missingMessage(platform) }, { status: 404 });
  }
  return NextResponse.redirect(fileUrl(platform), 302);
}
