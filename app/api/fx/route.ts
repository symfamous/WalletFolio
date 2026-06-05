import { NextResponse } from "next/server";
import { FALLBACK_RATES, fetchFxRates } from "@/lib/fx/rates";
import type { FxApiResponse } from "@/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await fetchFxRates();
    const response: FxApiResponse = {
      rates: result.rates,
      updatedAt: result.updatedAt,
    };
    return NextResponse.json(response, {
      headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=7200" },
    });
  } catch (error) {
    console.warn("[fx] route fallback after unexpected failure:", error);
    const response: FxApiResponse = {
      rates: FALLBACK_RATES,
      updatedAt: new Date().toISOString(),
    };
    return NextResponse.json(response, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=900" },
    });
  }
}
