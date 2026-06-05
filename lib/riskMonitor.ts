import { Eye, ShieldAlert, ShieldCheck } from "lucide-react";
import type { UnifiedRiskState } from "../types";

export {
  buildUnifiedRiskSummary,
  getAlertStatusCopy,
  getLegacyRiskLevel,
  getRiskSummaryLine,
  RISK_THRESHOLDS,
} from "./riskTruth.ts";

export function getRiskStatePresentation(state: UnifiedRiskState) {
  switch (state) {
    case "Critical":
      return {
        label: "Critical",
        badgeText: "Critical",
        badgeVariant: "danger" as const,
        textClassName: "text-danger",
        icon: ShieldAlert,
        legacyLevel: "critical" as const,
      };
    case "Risky":
      return {
        label: "Risky",
        badgeText: "Risky",
        badgeVariant: "warning" as const,
        textClassName: "text-warning",
        icon: ShieldAlert,
        legacyLevel: "risky" as const,
      };
    case "Watch":
      return {
        label: "Watch",
        badgeText: "Watch",
        badgeVariant: "warning" as const,
        textClassName: "text-warning",
        icon: Eye,
        legacyLevel: "moderate" as const,
      };
    case "Safe":
    default:
      return {
        label: "Safe",
        badgeText: "Safe",
        badgeVariant: "success" as const,
        textClassName: "text-success",
        icon: ShieldCheck,
        legacyLevel: "safe" as const,
      };
  }
}
