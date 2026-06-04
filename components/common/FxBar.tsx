"use client";

import { useState, useEffect } from "react";
import { Globe, ArrowLeftRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SupportedCurrency } from "@/types";
import { CURRENCY_LABELS, CURRENCY_SYMBOLS } from "@/types";

const CURRENCIES: SupportedCurrency[] = [
  "USD","INR","NPR","EUR","GBP","AED","SGD","JPY","TRY","IDR","CAD",
  "AUD","CHF","SAR","HKD",
];

interface FxBarProps {
  currency:         SupportedCurrency;
  onChangeCurrency: (c: SupportedCurrency) => void;
  rates:            Record<string, number>;
  isFallback?:      boolean;
  className?:       string;
}

export function FxBar({ currency, onChangeCurrency, rates, isFallback, className }: FxBarProps) {
  const rate   = rates[currency] ?? 1;
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;

  // Two-way manual input state
  const [usdInput,   setUsdInput]   = useState("1");
  const [localInput, setLocalInput] = useState("");

  // Keep local input in sync when currency or rate changes
  useEffect(() => {
    const num = parseFloat(usdInput);
    if (isFinite(num)) {
      setLocalInput((num * rate).toFixed(rate >= 100 ? 0 : rate >= 1 ? 2 : 4));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, rate]);

  function handleUsdChange(val: string) {
    setUsdInput(val);
    const num = parseFloat(val);
    if (isFinite(num) && num >= 0) {
      setLocalInput((num * rate).toFixed(rate >= 100 ? 0 : rate >= 1 ? 2 : 4));
    } else if (val === "" || val === ".") {
      setLocalInput("");
    }
  }

  function handleLocalChange(val: string) {
    setLocalInput(val);
    const num = parseFloat(val);
    if (isFinite(num) && num >= 0 && rate > 0) {
      setUsdInput((num / rate).toFixed(6).replace(/\.?0+$/, ""));
    } else if (val === "" || val === ".") {
      setUsdInput("");
    }
  }

  const inputClass = "w-full h-9 px-3 rounded-lg num text-sm bg-surface-raised border border-border text-text-hi placeholder:text-text-lo focus:outline-none focus:border-accent/50 transition-colors text-right";

  return (
    <div className={cn("rounded-xl border border-border bg-surface overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
        <Globe className="h-4 w-4 text-text-lo flex-shrink-0" strokeWidth={1.5} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-text-lo">Currency display</p>
          {currency !== "USD" && (
            <p className="num text-[10px] text-text-lo mt-0.5">
              1 USD = {symbol}{new Intl.NumberFormat("en-US", {
                minimumFractionDigits: rate >= 1 ? 2 : 4,
                maximumFractionDigits: rate >= 1 ? 2 : 6,
              }).format(rate)}
              {isFallback && <span className="ml-1 text-warning/60">(approx)</span>}
            </p>
          )}
        </div>
        <select
          value={currency}
          onChange={(e) => onChangeCurrency(e.target.value as SupportedCurrency)}
          className="h-8 px-2 rounded-lg text-xs bg-surface-raised border border-border text-text-hi focus:outline-none focus:border-accent/40 cursor-pointer transition-colors flex-shrink-0"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {CURRENCY_SYMBOLS[c]} {c} — {CURRENCY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      {/* Manual converter — only shown when non-USD selected */}
      {currency !== "USD" && (
        <div className="px-4 py-3 space-y-2">
          <p className="text-[11px] text-text-lo font-medium uppercase tracking-widest">
            Convert
          </p>

          <div className="flex items-center gap-2">
            {/* USD input */}
            <div className="flex-1">
              <p className="text-[10px] text-text-lo mb-1">USD</p>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 num text-xs text-text-lo">$</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={usdInput}
                  onChange={(e) => handleUsdChange(e.target.value)}
                  placeholder="0"
                  className={cn(inputClass, "pl-6")}
                />
              </div>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center pt-4">
              <ArrowLeftRight className="h-3.5 w-3.5 text-text-lo" />
            </div>

            {/* Local currency input */}
            <div className="flex-1">
              <p className="text-[10px] text-text-lo mb-1">{currency}</p>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 num text-xs text-accent">
                  {symbol}
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={localInput}
                  onChange={(e) => handleLocalChange(e.target.value)}
                  placeholder="0"
                  className={cn(inputClass, "pl-7 border-accent/20 focus:border-accent/50 text-accent")}
                />
              </div>
            </div>
          </div>

          {/* Quick amounts */}
          <div className="flex gap-1.5 flex-wrap">
            {[1, 10, 100, 1000].map((amt) => (
              <button
                key={amt}
                onClick={() => handleUsdChange(String(amt))}
                className="num text-[10px] px-2 py-0.5 rounded-md border border-border text-text-lo hover:border-accent/40 hover:text-accent hover:bg-accent/5 transition-colors"
              >
                ${amt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}