/**
 * app/api/perps/[address]/route.ts
 *
 * Multi-platform perp positions + PnL analytics.
 * Aggregates: Hyperliquid + dYdX v4 (more platforms easy to add)
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchAllPerps }             from "@/lib/providers/perps";
import { fetchDriftPerps }           from "@/lib/providers/perps/drift";
import { isValidAddress, isSolanaAddress }            from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address: raw } = await params;
  const isSolana = isSolanaAddress(raw.trim()) && !raw.startsWith("0x");
  const address  = isSolana ? raw.trim() : raw.toLowerCase();

  if (!isValidAddress(address) && !isSolanaAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  if (isSolana) {
    const drift = await fetchDriftPerps(address);
    return NextResponse.json({
      platforms: [drift],
      allPositions: drift.positions,
      totalUnrealizedPnl: drift.pnl.unrealizedPnl,
      totalRealizedPnl: drift.pnl.realizedPnl,
      totalFunding: drift.pnl.totalFunding,
      totalFees: drift.pnl.totalFees,
      netLifetimePnl: drift.pnl.netLifetime,
      totalAccountValue: drift.accountSummary?.accountValue ?? 0,
      openPositionCount: 0,
      hasAnyPositions: false,
      isPartialData: true,
    }, { headers: { "Cache-Control": "s-maxage=5, stale-while-revalidate=15" } });
  }

  const perps = await fetchAllPerps(address);

  return NextResponse.json(perps, {
    headers: { "Cache-Control": "s-maxage=5, stale-while-revalidate=15" },
  });
}
