/**
 * lib/alerts/index.ts
 *
 * Personal alert rules and notification system.
 * Stored locally in localStorage.
 */

export type AlertConditionType =
  | "portfolio_drop_pct"
  | "portfolio_rise_pct"
  | "token_price_target"
  | "chain_concentration"
  | "protocol_concentration"
  | "liquidation_risk"
  | "perp_pnl_threshold"
  | "hidden_funds_found"
  | "new_defi_position";

export interface AlertRule {
  id: string;
  label: string;
  conditionType: AlertConditionType;
  // Condition params
  tokenSymbol?: string;
  thresholdValue?: number;       // % or $ depending on type
  chainSlug?: string;
  protocolId?: string;
  direction?: "above" | "below"; // for price/pct targets
  enabled: boolean;
  createdAt: string;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  ruleLabel: string;
  message: string;
  severity: "info" | "warning" | "critical";
  timestamp: string;
  read: boolean;
  dismissed: boolean;
  data?: Record<string, unknown>;
}

const RULES_KEY    = "folio_alert_rules";
const EVENTS_KEY   = "folio_alert_events";
const MAX_EVENTS   = 100;

// ── Rules ─────────────────────────────────────────────────────────

export function loadAlertRules(): AlertRule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RULES_KEY);
    return raw ? (JSON.parse(raw) as AlertRule[]) : getDefaultRules();
  } catch {
    return getDefaultRules();
  }
}

export function saveAlertRules(rules: AlertRule[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(RULES_KEY, JSON.stringify(rules));
}

export function addAlertRule(rule: Omit<AlertRule, "id" | "createdAt">): AlertRule {
  const full: AlertRule = {
    ...rule,
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(-4)}`,
    createdAt: new Date().toISOString(),
  };
  const existing = loadAlertRules();
  saveAlertRules([...existing, full]);
  return full;
}

export function deleteAlertRule(id: string): void {
  const rules = loadAlertRules().filter((r) => r.id !== id);
  saveAlertRules(rules);
}

export function toggleAlertRule(id: string): void {
  const rules = loadAlertRules().map((r) =>
    r.id === id ? { ...r, enabled: !r.enabled } : r
  );
  saveAlertRules(rules);
}

function getDefaultRules(): AlertRule[] {
  return [
    {
      id: "default-drop-10",
      label: "Portfolio drops 10%",
      conditionType: "portfolio_drop_pct",
      thresholdValue: 10,
      direction: "below",
      enabled: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "default-rise-20",
      label: "Portfolio gains 20%",
      conditionType: "portfolio_rise_pct",
      thresholdValue: 20,
      direction: "above",
      enabled: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "default-chain-conc",
      label: "Chain concentration >80%",
      conditionType: "chain_concentration",
      thresholdValue: 80,
      direction: "above",
      enabled: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "default-liq-risk",
      label: "Liquidation risk detected",
      conditionType: "liquidation_risk",
      enabled: true,
      createdAt: new Date().toISOString(),
    },
  ];
}

// ── Events ────────────────────────────────────────────────────────

export function loadAlertEvents(): AlertEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    return raw ? (JSON.parse(raw) as AlertEvent[]) : [];
  } catch {
    return [];
  }
}

export function saveAlertEvents(events: AlertEvent[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
}

export function fireAlertEvent(event: Omit<AlertEvent, "id" | "timestamp" | "read" | "dismissed">): AlertEvent {
  const full: AlertEvent = {
    ...event,
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(-4)}`,
    timestamp: new Date().toISOString(),
    read: false,
    dismissed: false,
  };
  const existing = loadAlertEvents();
  saveAlertEvents([...existing, full]);
  return full;
}

export function markAllRead(): void {
  const events = loadAlertEvents().map((e) => ({ ...e, read: true }));
  saveAlertEvents(events);
}

export function dismissEvent(id: string): void {
  const events = loadAlertEvents().map((e) =>
    e.id === id ? { ...e, dismissed: true, read: true } : e
  );
  saveAlertEvents(events);
}

// ── Evaluator ─────────────────────────────────────────────────────

import type { Portfolio, PerpsApiResponse, PortfolioIntelligence } from "@/types";
import type { PortfolioSnapshot } from "@/lib/snapshots";

export function evaluateAlerts(
  rules: AlertRule[],
  portfolio: Portfolio,
  intelligence: PortfolioIntelligence,
  snapshots: PortfolioSnapshot[],
  perps?: PerpsApiResponse | null
): AlertEvent[] {
  const fired: AlertEvent[] = [];
  const existingEvents = loadAlertEvents();
  const now = Date.now();

  for (const rule of rules) {
    if (!rule.enabled) continue;

    // Cooldown: don't re-fire same rule within 1 hour
    const lastFired = existingEvents
      .filter((e) => e.ruleId === rule.id && !e.dismissed)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    if (lastFired) {
      const age = now - new Date(lastFired.timestamp).getTime();
      if (age < 60 * 60 * 1000) continue;
    }

    const event = checkRule(rule, portfolio, intelligence, snapshots, perps);
    if (event) {
      fired.push(fireAlertEvent(event));
    }
  }

  return fired;
}

function checkRule(
  rule: AlertRule,
  portfolio: Portfolio,
  intelligence: PortfolioIntelligence,
  snapshots: PortfolioSnapshot[],
  perps?: PerpsApiResponse | null
): Omit<AlertEvent, "id" | "timestamp" | "read" | "dismissed"> | null {
  const s = portfolio.summary;

  switch (rule.conditionType) {
    case "portfolio_drop_pct": {
      const prev = snapshots[snapshots.length - 2];
      if (!prev || prev.totalUsdValue === 0) return null;
      const pct = ((s.totalUsdValue - prev.totalUsdValue) / prev.totalUsdValue) * 100;
      if (pct < -(rule.thresholdValue ?? 10)) {
        return {
          ruleId: rule.id,
          ruleLabel: rule.label,
          message: `Portfolio dropped ${Math.abs(pct).toFixed(1)}% vs last snapshot`,
          severity: "warning",
          data: { pct },
        };
      }
      break;
    }

    case "portfolio_rise_pct": {
      const prev = snapshots[snapshots.length - 2];
      if (!prev || prev.totalUsdValue === 0) return null;
      const pct = ((s.totalUsdValue - prev.totalUsdValue) / prev.totalUsdValue) * 100;
      if (pct > (rule.thresholdValue ?? 20)) {
        return {
          ruleId: rule.id,
          ruleLabel: rule.label,
          message: `Portfolio up ${pct.toFixed(1)}% vs last snapshot 🎉`,
          severity: "info",
          data: { pct },
        };
      }
      break;
    }

    case "token_price_target": {
      if (!rule.tokenSymbol || !rule.thresholdValue) return null;
      const holding = portfolio.aggregated.find(
        (h) => h.symbol.toLowerCase() === rule.tokenSymbol!.toLowerCase()
      );
      if (!holding?.price) return null;
      const hit =
        rule.direction === "above"
          ? holding.price >= rule.thresholdValue
          : holding.price <= rule.thresholdValue;
      if (hit) {
        return {
          ruleId: rule.id,
          ruleLabel: rule.label,
          message: `${rule.tokenSymbol} hit $${holding.price.toFixed(2)} (target: $${rule.thresholdValue})`,
          severity: "info",
          data: { price: holding.price, target: rule.thresholdValue },
        };
      }
      break;
    }

    case "chain_concentration": {
      const top = portfolio.chainAllocations[0];
      if (!top) return null;
      if (top.percentage > (rule.thresholdValue ?? 80)) {
        return {
          ruleId: rule.id,
          ruleLabel: rule.label,
          message: `${top.chainName} holds ${top.percentage.toFixed(0)}% of portfolio`,
          severity: "warning",
          data: { chain: top.chainName, pct: top.percentage },
        };
      }
      break;
    }

    case "protocol_concentration": {
      const top = portfolio.protocolAllocations[0];
      if (!top) return null;
      if (top.percentage > (rule.thresholdValue ?? 70)) {
        return {
          ruleId: rule.id,
          ruleLabel: rule.label,
          message: `${top.protocolName} holds ${top.percentage.toFixed(0)}% of DeFi value`,
          severity: "warning",
          data: { protocol: top.protocolName, pct: top.percentage },
        };
      }
      break;
    }

    case "liquidation_risk": {
      const liquidation = intelligence.risk.triggeredFactors.find(
        (factor) => factor.id === "liquidation_risk" && factor.state === "Critical"
      );
      if (liquidation) {
        return {
          ruleId: rule.id,
          ruleLabel: rule.label,
          message: liquidation.explanation,
          severity: "critical",
          data: { factor: liquidation.id },
        };
      }
      break;
    }

    case "perp_pnl_threshold": {
      const upnl = perps?.totalUnrealizedPnl ?? 0;
      if (!rule.thresholdValue) return null;
      const hit =
        rule.direction === "below"
          ? upnl < -Math.abs(rule.thresholdValue)
          : upnl > rule.thresholdValue;
      if (hit) {
        return {
          ruleId: rule.id,
          ruleLabel: rule.label,
          message: `Perp unrealized PnL is $${upnl.toFixed(0)}`,
          severity: upnl < 0 ? "warning" : "info",
          data: { upnl },
        };
      }
      break;
    }

    case "hidden_funds_found": {
      if (intelligence.hiddenFunds.length > 0) {
        const total = intelligence.hiddenFunds.reduce((s, f) => s + f.usdValue, 0);
        if (total > 10) {
          return {
            ruleId: rule.id,
            ruleLabel: rule.label,
            message: `${intelligence.hiddenFunds.length} idle/hidden funds found worth $${total.toFixed(0)}`,
            severity: "info",
            data: { count: intelligence.hiddenFunds.length, total },
          };
        }
      }
      break;
    }
  }

  return null;
}
