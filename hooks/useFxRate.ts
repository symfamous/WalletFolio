"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { FxApiResponse, SupportedCurrency } from "@/types";
import { convertUSD, formatFx } from "@/lib/fx/rates";

async function fetchFxRates(): Promise<FxApiResponse> {
  const res = await fetch("/api/fx");
  if (!res.ok) throw new Error(`FX HTTP ${res.status}`);
  return res.json();
}

const CURRENCY_KEY = "folio_currency";

export function useFxRate() {
  const [currency, setCurrencyState] = useState<SupportedCurrency>("USD");

  useEffect(() => {
    const saved = localStorage.getItem(CURRENCY_KEY) as SupportedCurrency | null;
    if (saved) setCurrencyState(saved);
  }, []);

  function setCurrency(c: SupportedCurrency) {
    setCurrencyState(c);
    localStorage.setItem(CURRENCY_KEY, c);
  }

  const q = useQuery<FxApiResponse, Error>({
    queryKey:  ["fx-rates"],
    queryFn:   fetchFxRates,
    staleTime: 3_600_000, // 1 hour
    gcTime:    7_200_000,
    retry:     1,
  });

  const rates = q.data?.rates ?? { USD: 1 };

  return {
    currency,
    setCurrency,
    rates,
    isLoading: q.isLoading,
    convert:   (usd: number) => convertUSD(usd, currency, rates),
    format:    (usd: number) => formatFx(usd, currency, rates),
  };
}
