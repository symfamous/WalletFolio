"use client";

import { AlertTriangle, ExternalLink, ShieldCheck } from "lucide-react";
import { useApprovals } from "@/hooks/useApprovals";
import { cn } from "@/lib/utils";

const RISK_STYLE = {
  danger: "border-danger/30 bg-danger/10 text-danger",
  warning: "border-warning/30 bg-warning/10 text-warning",
  ok: "border-border bg-surface-raised text-text-lo",
} as const;

/**
 * Token approval / allowance scanner (GoPlus, free). Flags unlimited and risky
 * spenders across chains and links out to revoke.cash to revoke them.
 */
export function ApprovalsScanner({ address }: { address: string }) {
  const { data, isLoading } = useApprovals(address);

  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-surface shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-lo">Token Approvals</p>
        {data ? (
          <p className="text-[11px] text-text-lo">
            {data.counts.total} total · <span className="text-warning">{data.counts.unlimited} unlimited</span>
            {data.counts.danger > 0 ? <> · <span className="text-danger">{data.counts.danger} risky</span></> : null}
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <p className="px-4 py-6 text-center text-sm text-text-lo">Scanning approvals across chains…</p>
      ) : !data || data.approvals.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-text-mid">
          <ShieldCheck className="h-4 w-4 text-success" />
          No active token approvals found — nothing to revoke.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {data.approvals.slice(0, 25).map((a) => (
            <div key={`${a.chainId}-${a.tokenAddress}-${a.spender}`} className="flex items-center gap-3 px-4 py-2.5">
              <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-medium", RISK_STYLE[a.risk])}>
                {a.risk === "danger" ? "RISK" : a.isUnlimited ? "∞" : "OK"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-hi">
                  {a.tokenSymbol} <span className="text-text-lo">on {a.chainName}</span>
                </p>
                <p className="truncate text-[11px] text-text-lo">
                  {a.spenderName} · {a.isUnlimited ? "Unlimited allowance" : a.amount || "limited"}
                </p>
              </div>
              {a.risk === "danger" ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-danger" /> : null}
              <a
                href={`https://revoke.cash/address/${address}?chainId=${a.chainId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 rounded-[8px] border border-border bg-surface-raised px-2.5 py-1 text-[11px] text-text-mid transition-colors hover:border-border-strong hover:text-text-hi"
              >
                Revoke <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
