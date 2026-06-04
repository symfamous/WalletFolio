"use client";

import { useMemo } from "react";
import { AlertTriangle, ExternalLink, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { useHistory } from "@/hooks/useHistory";
import { buildWalletSafetySummary } from "@/lib/walletSafety";
import { cn } from "@/lib/utils";

export function WalletSafetyScanner({ address }: { address: string }) {
  const history = useHistory(address);
  const summary = useMemo(() => buildWalletSafetySummary(history.events), [history.events]);
  const stateClass = summary.state === "Clear"
    ? "border-success/20 bg-success/5 text-success"
    : summary.state === "High Risk"
      ? "border-warning/30 bg-warning/7 text-warning"
      : "border-accent/20 bg-accent/7 text-accent";

  return (
    <div className="space-y-4">
      <div className={cn("flex items-start gap-3 rounded-xl border p-4", stateClass)}>
        {summary.state === "Clear"
          ? <ShieldCheck className="h-8 w-8 flex-shrink-0" />
          : <ShieldAlert className="h-8 w-8 flex-shrink-0" />}
        <div className="min-w-0">
          <p className="text-sm font-semibold">Wallet Safety: {summary.state}</p>
          <p className="mt-1 text-xs text-text-mid">{summary.note}</p>
        </div>
        {history.isFetching ? <Loader2 className="ml-auto h-4 w-4 animate-spin text-accent" /> : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { label: "Approvals found", value: summary.approvalCount },
          { label: "Approvals in 30 days", value: summary.recentApprovalCount },
          { label: "Records scanned", value: history.events.length },
        ].map((metric) => (
          <div key={metric.label} className="rounded-xl border border-border bg-surface-raised p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-text-lo">{metric.label}</p>
            <p className="num mt-1 text-lg font-semibold text-text-hi">{metric.value}</p>
          </div>
        ))}
      </div>

      {history.isError ? (
        <p className="rounded-xl border border-warning/25 bg-warning/6 p-3 text-xs text-warning">
          Activity could not be loaded, so approval scanning is incomplete.
        </p>
      ) : summary.findings.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface-raised p-4 text-xs text-text-mid">
          No approval transactions were found in loaded history.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-text-lo">Approval review queue</p>
          {summary.findings.map((finding) => (
            <div key={finding.id} className="rounded-xl border border-border bg-surface-raised p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className={cn(
                  "mt-0.5 h-4 w-4 flex-shrink-0",
                  finding.severity === "warning" ? "text-warning" : "text-text-lo"
                )} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-hi">{finding.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-text-mid">{finding.explanation}</p>
                  <p className="mt-1.5 text-[10px] text-text-lo">{new Date(finding.timestamp).toLocaleString()}</p>
                </div>
                {finding.explorerUrl ? (
                  <a
                    href={finding.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${finding.title} transaction`}
                    className="rounded-lg border border-accent/15 p-2 text-accent hover:bg-accent/8"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
      {history.hasMore ? (
        <button
          type="button"
          onClick={history.loadMore}
          disabled={history.isFetching}
          className="w-full rounded-xl border border-accent/18 px-3 py-2 text-xs text-accent transition-colors hover:bg-accent/8 disabled:opacity-40"
        >
          {history.isFetching ? "Scanning older activity..." : "Scan older activity for approvals"}
        </button>
      ) : null}
    </div>
  );
}
