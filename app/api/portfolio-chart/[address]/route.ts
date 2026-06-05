/**
 * app/api/portfolio-chart/[address]/route.ts
 *
 * Real historical portfolio value (USD over time) from Zerion's chart endpoint.
 * Returns `{ points: [{ timestamp, total }] }` for the requested range.
 */
import { NextRequest, NextResponse } from "next/server";
import { isValidAddress } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Map the UI range to a Zerion chart period.
const PERIOD_MAP: Record<string, string> = {
  "1H": "hour",
  "4H": "day",
  "24H": "day",
  "7D": "week",
  "30D": "month",
  "1Y": "year",
  ALL: "max",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address: raw } = await params;
  const address = raw.toLowerCase();
  if (!isValidAddress(address)) {
    return NextResponse.json({ error: "Invalid EVM address", points: [] }, { status: 400 });
  }

  const range = new URL(req.url).searchParams.get("range") ?? "30D";
  const period = PERIOD_MAP[range] ?? "month";
  const key = process.env.ZERION_API_KEY ?? "";
  if (!key) return NextResponse.json({ points: [], range });

  try {
    const auth = `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
    const res = await fetch(
      `https://api.zerion.io/v1/wallets/${address}/charts/${period}?currency=usd`,
      { headers: { Authorization: auth, accept: "application/json" }, cache: "no-store" }
    );
    if (!res.ok) return NextResponse.json({ points: [], range });
    const data = (await res.json()) as { data?: { attributes?: { points?: [number, number][] } } };
    const raw = data?.data?.attributes?.points ?? [];
    const points = raw
      .filter((p) => Array.isArray(p) && p.length === 2)
      .map(([ts, value]) => ({ timestamp: new Date(ts * 1000).toISOString(), total: value }));
    return NextResponse.json(
      { points, range },
      { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=300" } }
    );
  } catch {
    return NextResponse.json({ points: [], range });
  }
}
