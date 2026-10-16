import { NextResponse } from "next/server";

export const maxDuration = 30;

const RELEASE = process.env.KETRA_DESKTOP_RELEASE || "v0.1.0";
const BASE = `https://github.com/Teckdegen/ketra/releases/download/${RELEASE}`;

const FILES = {
  mac: "Ketra-macOS.dmg",
  windows: "Ketra-Windows.exe",
  linux: "Ketra-linux.AppImage",
} as const;

/** Single-file apps on the release. Linux/macOS ship from CI; Windows is packed locally. */
const PUBLISHED: Record<keyof typeof FILES, boolean> = {
  mac: false,
  windows: true,
  linux: false,
};

type Platform = keyof typeof FILES;

function isPlatform(value: string): value is Platform {
  return value === "mac" || value === "windows" || value === "linux";
}

function missingMessage(platform: Platform) {
  return platform === "mac"
    ? "The macOS build is not published yet. It needs a Mac pack step."
    : "That build is not published yet.";
}

/** Desktop install starts on our domain. Bytes come from the release CDN after a quiet redirect. */
export async function HEAD(_request: Request, context: { params: Promise<{ platform: string }> }) {
  const { platform } = await context.params;
  if (!isPlatform(platform)) return new NextResponse(null, { status: 404 });
  return new NextResponse(null, { status: PUBLISHED[platform] ? 200 : 404 });
}

export async function GET(_request: Request, context: { params: Promise<{ platform: string }> }) {
  const { platform } = await context.params;
  if (!isPlatform(platform)) {
    return NextResponse.json({ error: "Unknown platform." }, { status: 404 });
  }
  if (!PUBLISHED[platform]) {
    return NextResponse.json({ error: missingMessage(platform) }, { status: 404 });
  }
  return NextResponse.redirect(`${BASE}/${FILES[platform]}`, 302);
}
