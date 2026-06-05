import type { HistoryEvent } from "@/types";

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const s = String(value);
  // Quote if it contains comma, quote, or newline; escape inner quotes.
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Trigger a client-side CSV download from rows + ordered columns. */
export function downloadCsv<T>(
  filename: string,
  rows: T[],
  columns: { header: string; value: (row: T) => unknown }[]
): void {
  if (typeof window === "undefined") return;
  const head = columns.map((c) => csvCell(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => csvCell(c.value(r))).join(",")).join("\n");
  const blob = new Blob(["﻿" + head + "\n" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Export wallet activity (history events) as a tax/accounting-friendly CSV. */
export function exportActivityCsv(address: string, events: HistoryEvent[]): void {
  const date = new Date().toISOString().slice(0, 10);
  downloadCsv(`walletfolio-activity-${address.slice(0, 8)}-${date}.csv`, events, [
    { header: "Date", value: (e) => new Date(e.timestamp).toISOString() },
    { header: "Type", value: (e) => e.type },
    { header: "Description", value: (e) => e.description },
    { header: "Chain", value: (e) => e.chainName },
    { header: "Asset", value: (e) => e.tokenSymbol ?? "" },
    { header: "Amount", value: (e) => e.tokenAmount ?? "" },
    { header: "To Asset", value: (e) => e.toTokenSymbol ?? "" },
    { header: "To Amount", value: (e) => e.toTokenAmount ?? "" },
    { header: "USD Value", value: (e) => (e.usdValue !== undefined ? e.usdValue.toFixed(2) : "") },
    { header: "Status", value: (e) => e.status },
    { header: "Tx Hash", value: (e) => e.txHash },
  ]);
}
