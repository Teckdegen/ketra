import { connection } from "next/server";
import { CHAIN_ID } from "@/lib/morpho";

const ENDPOINT = "https://api.morpho.org/graphql";

export const HISTORY_RANGES = ["30m", "24h", "7d", "1m", "1y"] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];
export type HistoryKind = "market" | "vault";
export type HistoryMetric = "supply" | "apy" | "price";

const windows: Record<HistoryRange, { seconds: number; interval: "HOUR" | "DAY" | "WEEK"; lookbackHours: number }> = {
  "30m": { seconds: 30 * 60, interval: "HOUR", lookbackHours: 1 },
  "24h": { seconds: 24 * 3600, interval: "HOUR", lookbackHours: 1 },
  "7d": { seconds: 7 * 24 * 3600, interval: "HOUR", lookbackHours: 24 },
  "1m": { seconds: 30 * 24 * 3600, interval: "DAY", lookbackHours: 24 },
  "1y": { seconds: 365 * 24 * 3600, interval: "DAY", lookbackHours: 24 },
};

export type HistoryPoint = { x: number; y: number };
export type HistorySeries = { start: number; end: number; points: HistoryPoint[] };

function selection(kind: HistoryKind, metric: HistoryMetric, interval: string, lookbackHours: number) {
  if (kind === "market" && metric === "supply") return `supplyAssetsUsd(options: { startTimestamp: $start, endTimestamp: $end, interval: ${interval} })`;
  if (kind === "market" && metric === "apy") return `supplyApy(options: { startTimestamp: $start, endTimestamp: $end, interval: ${interval} })`;
  if (kind === "vault" && metric === "supply") return `totalAssetsUsd(options: { startTimestamp: $start, endTimestamp: $end, interval: ${interval} })`;
  if (kind === "vault" && metric === "apy") {
    return `avgNetApy(options: { startTimestamp: $start, endTimestamp: $end, interval: ${interval} }, lookbackHours: ${lookbackHours})`;
  }
  if (kind === "vault" && metric === "price") return `sharePrice(options: { startTimestamp: $start, endTimestamp: $end, interval: ${interval} })`;
  return null;
}

function idOk(kind: HistoryKind, id: string) {
  if (kind === "market") return /^0x[a-fA-F0-9]{64}$/.test(id);
  return /^0x[a-fA-F0-9]{40}$/.test(id);
}

export async function getHistory(kind: HistoryKind, id: string, metric: HistoryMetric, range: HistoryRange): Promise<HistorySeries | null> {
  const series = selection(kind, metric, windows[range].interval, windows[range].lookbackHours);
  if (!series || !idOk(kind, id)) return null;
  await connection();
  const window = windows[range];
  const end = Math.floor(Date.now() / 1000);
  const start = end - window.seconds;
  const query =
    kind === "market"
      ? `query($id: String!, $chainId: Int!, $start: Int!, $end: Int!) {
          markets(first: 1, where: { chainId_in: [$chainId], uniqueKey_in: [$id] }) {
            items { historicalState { series: ${series} { x y } } }
          }
        }`
      : `query($id: String!, $chainId: Int!, $start: Int!, $end: Int!) {
          vaultV2ByAddress(address: $id, chainId: $chainId) {
            historicalState { series: ${series} { x y } }
          }
        }`;
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { id: id.toLowerCase(), chainId: CHAIN_ID, start, end } }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Morpho did not answer.");
  const body = (await response.json()) as {
    data?: { markets?: { items: { historicalState?: { series?: { x: number; y: number }[] } }[] }; vaultV2ByAddress?: { historicalState?: { series?: { x: number; y: number }[] } } | null };
    errors?: { message: string }[];
  };
  if (body.errors?.length) throw new Error(body.errors[0].message);
  const raw = kind === "market" ? body.data?.markets?.items?.[0]?.historicalState?.series : body.data?.vaultV2ByAddress?.historicalState?.series;
  const points = (raw ?? [])
    .map((point) => ({ x: Number(point.x), y: Number(point.y) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= start && point.x <= end + 120)
    .sort((a, b) => a.x - b.x);
  const last = points[points.length - 1]?.x ?? end;
  return { start, end: Math.max(end, last), points };
}
