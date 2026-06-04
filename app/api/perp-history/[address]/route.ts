import { NextRequest, NextResponse } from "next/server";
import { discoverPerpHistory } from "@/lib/providers/perp_history";
import { isSolanaAddress, isValidAddress } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address: raw } = await params;
  const trimmed = raw.trim();
  const isSolana = isSolanaAddress(trimmed) && !trimmed.startsWith("0x");
  const address = isSolana ? trimmed : trimmed.toLowerCase();

  if (!isValidAddress(address) && !isSolanaAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    const report = await discoverPerpHistory(
      address,
      isSolana ? "solana" : "evm",
      trimmed,
    );
    return NextResponse.json(report, {
      headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[perp-history] discovery failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
