import { NextRequest, NextResponse } from "next/server";
import { debugZerionPositionsPage } from "@/lib/providers/zerion";
import { isValidAddress, isSolanaAddress } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { address: raw } = await params;
  const address = raw.toLowerCase();
  const ZERION_API_KEY = process.env.ZERION_API_KEY ?? "";

  if (!isValidAddress(address)) {
    if (isSolanaAddress(address)) {
      return NextResponse.json(
        { error: `Solana address detected — use /api/solana/${address}` },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Invalid EVM address" }, { status: 400 });
  }

  const startedAt = Date.now();
  const page = await debugZerionPositionsPage(address, ZERION_API_KEY, undefined, "no_filter");
  const durationMs = Date.now() - startedAt;

  const response = {
    provider: "zerion",
    mode: "development-only-debug",
    address,
    authConfigured: Boolean(ZERION_API_KEY),
    requestStartedAt: page.startedAt,
    totalDurationMs: durationMs,
    endpoint: page.url,
    httpStatus: page.httpStatus ?? null,
    providerReason: page.providerReason ?? null,
    finalReason: page.finalReason,
    requestCompleted: page.httpStatus !== undefined,
    responseBodyPresent: page.responseBodyPresent,
    responsePreview: page.responsePreview ?? null,
    parsedCount: page.parsedCount,
    emptyAfterParse: page.isEmptyAfterParse,
    nextCursor: page.nextCursor ?? null,
    parseError: page.parseError ?? null,
    ok: page.ok,
    summary:
      page.finalReason === "success"
        ? "Zerion returned usable portfolio positions."
        : page.finalReason === "valid_empty"
          ? "Zerion returned a valid response but no usable positions."
          : page.finalReason === "parser_mismatch"
            ? "Zerion returned a response that did not match the expected schema."
            : `Zerion request failed with ${page.finalReason ?? "unknown"} .`,
  };

  console.info(
    `[debug/zerion] duration=${durationMs}ms status=${response.httpStatus ?? "none"} finalReason=${response.finalReason} parsedCount=${response.parsedCount} empty=${response.emptyAfterParse}`
  );
  if (!response.ok) {
    console.warn("[debug/zerion] failure detail:", {
      providerReason: response.providerReason,
      finalReason: response.finalReason,
      parseError: response.parseError,
      responsePreview: response.responsePreview,
    });
  }

  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}
