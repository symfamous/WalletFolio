import type { HistoryEvent } from "@/types";

export type SafetySeverity = "info" | "warning" | "critical";

export interface WalletSafetyFinding {
  id: string;
  severity: SafetySeverity;
  title: string;
  explanation: string;
  timestamp: string;
  explorerUrl?: string;
}

export interface WalletSafetySummary {
  state: "Clear" | "Review" | "High Risk";
  approvalCount: number;
  recentApprovalCount: number;
  failedTransactionCount: number;
  findings: WalletSafetyFinding[];
  note: string;
}

export function buildWalletSafetySummary(events: HistoryEvent[], now = Date.now()): WalletSafetySummary {
  const approvals = events
    .filter((event) => event.type === "approve")
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const recentApprovalCount = approvals.filter(
    (event) => new Date(event.timestamp).getTime() >= thirtyDaysAgo
  ).length;
  const failedTransactionCount = events.filter((event) => event.status === "failed").length;
  const approvalKeys = new Map<string, number>();

  for (const event of approvals) {
    const key = `${event.tokenSymbol ?? "unknown"}:${event.counterparty ?? "unknown"}`.toLowerCase();
    approvalKeys.set(key, (approvalKeys.get(key) ?? 0) + 1);
  }

  const findings = approvals.slice(0, 12).map((event) => {
    const key = `${event.tokenSymbol ?? "unknown"}:${event.counterparty ?? "unknown"}`.toLowerCase();
    const repeated = (approvalKeys.get(key) ?? 0) > 1;
    const missingSpender = !event.counterparty;
    const severity: SafetySeverity = missingSpender || repeated ? "warning" : "info";
    const token = event.tokenSymbol ?? "Token";
    return {
      id: event.id,
      severity,
      title: `${token} approval${repeated ? " repeated" : ""}`,
      explanation: missingSpender
        ? "Approval transaction detected, but spender details are unavailable in loaded activity. Review this approval in a dedicated allowance tool."
        : repeated
          ? `Multiple approvals were detected for ${event.counterparty}. Verify whether any allowance remains necessary.`
          : `Approval transaction detected for ${event.counterparty}. Verify whether this allowance is still required.`,
      timestamp: event.timestamp,
      explorerUrl: event.explorerUrl,
    };
  });

  const hasWarning = findings.some((finding) => finding.severity !== "info");
  const state = hasWarning ? "High Risk" : approvals.length > 0 ? "Review" : "Clear";

  return {
    state,
    approvalCount: approvals.length,
    recentApprovalCount,
    failedTransactionCount,
    findings,
    note: "This scan detects approval transactions in loaded history. It does not query current active allowance balances.",
  };
}
