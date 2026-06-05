import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface StatCardProps {
  /** Uppercase muted label, e.g. "Total value" */
  label: string;
  /** Primary value — pre-formatted string or node */
  value: ReactNode;
  /** Optional signed delta (e.g. +2.4%) — colored by `deltaTone` */
  delta?: ReactNode;
  /** Tone for the delta: positive (green), negative (red), or neutral */
  deltaTone?: "positive" | "negative" | "neutral";
  /** Optional small icon shown beside the label */
  icon?: ReactNode;
  /** Optional sub-line under the value */
  sub?: ReactNode;
  /** Color the primary value (for P&L / signed metrics) */
  valueTone?: "positive" | "negative" | "neutral";
  className?: string;
}

/**
 * Compact KPI tile — dense by design (small uppercase label, tight value,
 * thin sub-line) so KPI strips read like a pro dashboard, not empty billboards.
 */
export function StatCard({
  label,
  value,
  delta,
  deltaTone = "neutral",
  icon,
  sub,
  valueTone = "neutral",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-[10px] border border-border bg-surface px-4 py-3 shadow-card",
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        {icon ? <span className="text-text-lo">{icon}</span> : null}
        <p className="text-[10.5px] font-medium uppercase tracking-wide text-text-lo">
          {label}
        </p>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <p
          className={cn(
            "num text-xl font-semibold leading-none tracking-tight",
            valueTone === "positive" && "text-success",
            valueTone === "negative" && "text-danger",
            valueTone === "neutral" && "text-text-hi"
          )}
        >
          {value}
        </p>
        {delta ? (
          <span
            className={cn(
              "num text-xs font-medium",
              deltaTone === "positive" && "text-success",
              deltaTone === "negative" && "text-danger",
              deltaTone === "neutral" && "text-text-lo"
            )}
          >
            {delta}
          </span>
        ) : null}
      </div>
      {sub ? <p className="mt-1 truncate text-[11px] text-text-lo">{sub}</p> : null}
    </div>
  );
}
