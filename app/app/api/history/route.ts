import { getHistory, HISTORY_RANGES, type HistoryKind, type HistoryMetric, type HistoryRange } from "@/lib/history";

const kinds = new Set<HistoryKind>(["market", "vault"]);
const metrics = new Set<HistoryMetric>(["supply", "apy", "price"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const id = url.searchParams.get("id") ?? "";
  const metric = url.searchParams.get("metric");
  const range = url.searchParams.get("range");
  if (!kind || !kinds.has(kind as HistoryKind) || !metric || !metrics.has(metric as HistoryMetric) || !range || !HISTORY_RANGES.includes(range as HistoryRange)) {
    return Response.json({ start: 0, end: 0, points: [] }, { status: 400 });
  }
  const series = await getHistory(kind as HistoryKind, id, metric as HistoryMetric, range as HistoryRange);
  if (!series) return Response.json({ start: 0, end: 0, points: [] }, { status: 400 });
  return Response.json(series);
}
