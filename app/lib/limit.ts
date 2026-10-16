const windows = new Map<string, number[]>();

export function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

export function allow(bucket: string, request: Request, max: number, windowMs: number) {
  const key = `${bucket}:${clientKey(request)}`;
  const now = Date.now();
  const recent = (windows.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= max) {
    windows.set(key, recent);
    return false;
  }
  recent.push(now);
  windows.set(key, recent);
  return true;
}
