import { NextResponse } from "next/server";
import { fetchVisibleOpenSeaNfts, getOpenSeaApiKey, NFT_MIN_VISIBLE_USD } from "@/lib/providers/opensea";
import { isSolanaAddress, isValidAddress } from "@/lib/utils";
import type { NftApiResponse } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address: raw } = await params;
  const trimmed = raw.trim();
  const isSolana = isSolanaAddress(trimmed) && !trimmed.startsWith("0x");
  const address = isSolana ? trimmed : trimmed.toLowerCase();
  if (!isValidAddress(address) && !isSolanaAddress(address)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  try {
    const requestedCursor = Number.parseInt(new URL(req.url).searchParams.get("collectionCursor") ?? "0", 10);
    const collectionCursor = Number.isFinite(requestedCursor) && requestedCursor >= 0 ? requestedCursor : 0;
    const apiAccess = await getOpenSeaApiKey();
    const result = await fetchVisibleOpenSeaNfts(address, apiAccess.key, isSolana ? "solana" : "evm", collectionCursor);
    const response: NftApiResponse = {
      ...result,
      source: "opensea",
      minValueUsd: NFT_MIN_VISIBLE_USD,
      configured: true,
      accessMode: apiAccess.accessMode,
      note: [
        result.note,
        apiAccess.accessMode === "instant-free" ? "Using an automatically issued OpenSea free-tier read key." : undefined,
      ].filter(Boolean).join(" "),
    };
    return NextResponse.json(response, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.warn("[nfts/opensea] fetch failed:", error);
    return NextResponse.json({ error: "OpenSea NFT holdings are unavailable." }, { status: 502 });
  }
}
