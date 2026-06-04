"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { FALLBACK_RATES, formatFx } from "@/lib/fx/rates";
import { cn } from "@/lib/utils";
import type { SupportedCurrency } from "@/types";

const LS_DEBT_ITEMS = "pseryte_debt_items";

type DebtItem = {
  id: string;
  name: string;
  amountUsd: number;
  totalAmountUsd: number;
  paid: boolean;
};

function readDebtItems(): DebtItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(LS_DEBT_ITEMS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        const hasCanonicalAmounts = "amountUsd" in item || "totalAmountUsd" in item;

        return {
          id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
          name: typeof item.name === "string" ? item.name : "",
          amountUsd: hasCanonicalAmounts ? Number(item.amountUsd) || 0 : Number(item.amount) || 0,
          totalAmountUsd: hasCanonicalAmounts ? Number(item.totalAmountUsd) || 0 : Number(item.totalAmount) || 0,
          paid: Boolean(item.paid),
        };
      })
      .filter((item) => item.name.trim() || item.amountUsd > 0 || item.totalAmountUsd > 0);
  } catch {
    return [];
  }
}

export function DebtToPaidTracker({
  currency,
  rates,
  framed = true,
}: {
  currency: SupportedCurrency;
  rates: Record<string, number>;
  framed?: boolean;
}) {
  const [debtItems, setDebtItems] = useState<DebtItem[]>([]);
  const [debtName, setDebtName] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtPaid, setDebtPaid] = useState(false);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [debtItemsLoaded, setDebtItemsLoaded] = useState(false);

  useEffect(() => {
    setDebtItems(readDebtItems());
    setDebtItemsLoaded(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !debtItemsLoaded) return;
    localStorage.setItem(LS_DEBT_ITEMS, JSON.stringify(debtItems));
  }, [debtItems, debtItemsLoaded]);

  const debtSummary = useMemo(() => {
    return debtItems.reduce(
      (summary, item) => {
        summary.total += item.amountUsd;
        if (item.paid) summary.paid += item.amountUsd;
        else summary.unpaid += item.amountUsd;
        return summary;
      },
      { paid: 0, unpaid: 0, total: 0 }
    );
  }, [debtItems]);

  function getRate(nextCurrency: SupportedCurrency) {
    return rates[nextCurrency] || FALLBACK_RATES[nextCurrency] || 1;
  }

  function selectedCurrencyToUsd(value: number) {
    const rate = getRate(currency);
    return value / rate;
  }

  function usdToSelectedCurrency(usdValue: number) {
    const rate = getRate(currency);
    return usdValue * rate;
  }

  function formatDebtAmount(usdValue: number, compact = false) {
    const converted = usdToSelectedCurrency(usdValue);

    if ((currency === "INR" || currency === "NPR") && Math.abs(converted) >= 1_000) {
      const formatUnit = (value: number) => {
        if (value >= 100) return value.toFixed(0);
        if (value >= 10) return value.toFixed(1).replace(/\.0$/, "");
        return value.toFixed(2).replace(/\.?0+$/, "");
      };

      if (Math.abs(converted) >= 10_000_000) return `${currency} ${formatUnit(converted / 10_000_000)} Crore`;
      if (Math.abs(converted) >= 100_000) return `${currency} ${formatUnit(converted / 100_000)} Lakh`;
      if (Math.abs(converted) >= 1_000) return `${currency} ${formatUnit(converted / 1_000)} Hazar`;
    }

    if (compact) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        notation: Math.abs(converted) >= 1_000 ? "compact" : "standard",
        maximumFractionDigits: Math.abs(converted) >= 1_000 ? 1 : 2,
      }).format(converted);
    }

    return formatFx(usdValue, currency, rates);
  }

  function resetDebtForm() {
    setDebtName("");
    setDebtAmount("");
    setDebtPaid(false);
    setEditingDebtId(null);
  }

  function saveDebtItem() {
    const name = debtName.trim();
    const amount = Number(debtAmount);
    if (!name || !Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const amountUsd = selectedCurrencyToUsd(amount);
    const nextItem = {
      id: editingDebtId ?? crypto.randomUUID(),
      name,
      amountUsd,
      totalAmountUsd: amountUsd,
      paid: debtPaid,
    };

    if (editingDebtId) {
      setDebtItems((items) => items.map((item) => (item.id === editingDebtId ? nextItem : item)));
      resetDebtForm();
      return;
    }

    setDebtItems((items) => [
      nextItem,
      ...items,
    ]);
    resetDebtForm();
  }

  function toggleDebtPaid(id: string) {
    setDebtItems((items) => items.map((item) => (item.id === id ? { ...item, paid: !item.paid } : item)));
  }

  function removeDebtItem(id: string) {
    setDebtItems((items) => items.filter((item) => item.id !== id));
    if (editingDebtId === id) resetDebtForm();
  }

  function startEditDebtItem(item: DebtItem) {
    setEditingDebtId(item.id);
    setDebtName(item.name);
    setDebtAmount(String(Number(usdToSelectedCurrency(item.amountUsd).toFixed(2))));
    setDebtPaid(item.paid);
  }

  const content = (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Paid", value: debtSummary.paid },
          { label: "Unpaid", value: debtSummary.unpaid },
          { label: "Total Amt", value: debtSummary.total },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-bg/40 px-3 py-2">
            <p className="text-[10px] uppercase tracking-widest text-text-lo">{label}</p>
            <p className="num mt-1 truncate text-sm font-semibold text-text-hi">{formatDebtAmount(value, true)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-text-lo">Name</span>
          <input
            type="text"
            value={debtName}
            onChange={(event) => setDebtName(event.target.value)}
            placeholder="Person or debt name"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text-hi placeholder:text-text-lo focus:border-accent/40 focus:outline-none"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-text-lo">Amt {currency}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={debtAmount}
            onChange={(event) => setDebtAmount(event.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text-hi placeholder:text-text-lo focus:border-accent/40 focus:outline-none"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setDebtPaid((paid) => !paid)}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors",
            debtPaid
              ? "border-success/30 bg-success/10 text-success"
              : "border-border bg-bg text-text-mid hover:text-text-hi"
          )}
        >
          <span
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded border",
              debtPaid ? "border-success bg-success text-bg" : "border-border"
            )}
          >
            {debtPaid && <Check className="h-3 w-3" />}
          </span>
          Paid
        </button>
        <button
          type="button"
          onClick={saveDebtItem}
          className="flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
        >
          {editingDebtId ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {editingDebtId ? "Save Debt" : "Add Debt"}
        </button>
        {editingDebtId && (
          <button
            type="button"
            onClick={resetDebtForm}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-text-mid transition-colors hover:text-text-hi"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
        )}
      </div>

      {debtItems.length > 0 ? (
        <div className="space-y-2">
          {debtItems.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-surface-raised p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-hi">{item.name}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-text-lo">Amt {formatDebtAmount(item.amountUsd)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleDebtPaid(item.id)}
                    className={cn(
                      "rounded-lg px-2 py-1 text-[10px] font-medium transition-colors",
                      item.paid
                        ? "bg-success/10 text-success hover:bg-success/20"
                        : "bg-warning/10 text-warning hover:bg-warning/20"
                    )}
                  >
                    {item.paid ? "Paid" : "Not Paid"}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEditDebtItem(item)}
                    className={cn(
                      "rounded-lg p-1.5 transition-colors",
                      editingDebtId === item.id
                        ? "bg-accent/10 text-accent"
                        : "text-text-lo hover:bg-accent/10 hover:text-accent"
                    )}
                    aria-label={`Edit ${item.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeDebtItem(item.id)}
                    className="rounded-lg p-1.5 text-text-lo transition-colors hover:bg-danger/10 hover:text-danger"
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-bg/30 p-4 text-center">
          <p className="text-xs text-text-lo">No debt records yet</p>
        </div>
      )}
    </div>
  );

  if (!framed) return content;
  return <Card>{content}</Card>;
}
