/**
 * lib/fx/rates.ts — free FX via open.er-api.com, 1h cache.
 */

import type { SupportedCurrency } from "@/types";

const FX_URL = "https://open.er-api.com/v6/latest/USD";
const FX_TIMEOUT_MS = 1_500;

export const FALLBACK_RATES: Record<string, number> = {
  USD: 1.0, INR: 84.0,   EUR: 0.92, GBP: 0.79,
  AED: 3.67, SGD: 1.35,  JPY: 149.5, TRY: 32.5,
  IDR: 15800, CAD: 1.36, AUD: 1.55, CHF: 0.90,
  SAR: 3.75, HKD: 7.82,  NPR: 134.5,
};

export interface FxResult {
  rates:      Record<string, number>;
  updatedAt:  string;
  isFallback: boolean;
}

let lastKnownFxResult: FxResult = {
  rates: FALLBACK_RATES,
  updatedAt: new Date().toISOString(),
  isFallback: true,
};

export async function fetchFxRates(): Promise<FxResult> {
  try {
    const res = await fetch(FX_URL, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(FX_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`FX HTTP ${res.status}`);
    const data: { result: string; time_last_update_utc: string; rates: Record<string, number> } = await res.json();
    if (data.result !== "success") throw new Error("non-success");
    lastKnownFxResult = { rates: data.rates, updatedAt: data.time_last_update_utc, isFallback: false };
    return lastKnownFxResult;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[fx] using fallback:", message);
    return {
      rates: lastKnownFxResult.rates ?? FALLBACK_RATES,
      updatedAt: lastKnownFxResult.updatedAt ?? new Date().toISOString(),
      isFallback: true,
    };
  }
}

export function convertUSD(usdValue: number, currency: SupportedCurrency, rates: Record<string, number>): number {
  if (currency === "USD") return usdValue;
  const rate = rates[currency] ?? FALLBACK_RATES[currency] ?? 1;
  return usdValue * rate;
}

export function formatFx(usdValue: number, currency: SupportedCurrency, rates: Record<string, number>): string {
  const converted = convertUSD(usdValue, currency, rates);
  return new Intl.NumberFormat("en-US", {
    style:                 "currency",
    currency,
    minimumFractionDigits: converted < 1 ? 4 : 0,
    maximumFractionDigits: converted < 1 ? 4 : 0,
    notation:              converted >= 1_000_000 ? "compact" : "standard",
  }).format(converted);
}
