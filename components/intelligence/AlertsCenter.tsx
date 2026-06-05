"use client";

import { useState } from "react";
import {
  Bell, X, Check, AlertTriangle, Info, Zap,
  Plus, Trash2, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn, formatUSD } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import type { UnifiedRiskState } from "@/types";
import type { AlertRule, AlertEvent, AlertConditionType } from "@/lib/alerts";

interface AlertsCenterProps {
  rules: AlertRule[];
  events: AlertEvent[];
  unreadCount: number;
  emptyStateTone?: UnifiedRiskState;
  emptyStateTitle?: string;
  emptyStateSubtitle?: string;
  onReadAll: () => void;
  onDismiss: (id: string) => void;
  onToggleRule: (id: string) => void;
  onDeleteRule: (id: string) => void;
  onAddRule: (rule: Omit<AlertRule, "id" | "createdAt">) => void;
}

function SeverityIcon({ severity }: { severity: AlertEvent["severity"] }) {
  if (severity === "critical") return <AlertTriangle className="h-4 w-4 text-danger flex-shrink-0" />;
  if (severity === "warning")  return <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />;
  return <Info className="h-4 w-4 text-accent flex-shrink-0" />;
}

const CONDITION_LABELS: Record<AlertConditionType, string> = {
  portfolio_drop_pct:      "Portfolio drops %",
  portfolio_rise_pct:      "Portfolio gains %",
  token_price_target:      "Token price target",
  chain_concentration:     "Chain concentration",
  protocol_concentration:  "Protocol concentration",
  liquidation_risk:        "Liquidation risk",
  perp_pnl_threshold:      "Perp PnL threshold",
  hidden_funds_found:      "Hidden funds found",
  new_defi_position:       "New DeFi position",
};

function AddRuleForm({ onAdd }: { onAdd: (rule: Omit<AlertRule, "id" | "createdAt">) => void }) {
  const [conditionType, setConditionType] = useState<AlertConditionType>("portfolio_drop_pct");
  const [threshold, setThreshold] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("below");
  const [label, setLabel] = useState("");

  function handleAdd() {
    const rule: Omit<AlertRule, "id" | "createdAt"> = {
      label: label || CONDITION_LABELS[conditionType],
      conditionType,
      thresholdValue: threshold ? parseFloat(threshold) : undefined,
      tokenSymbol: tokenSymbol || undefined,
      direction,
      enabled: true,
    };
    onAdd(rule);
    setThreshold("");
    setTokenSymbol("");
    setLabel("");
  }

  const needsToken = conditionType === "token_price_target";
  const needsThreshold = !["liquidation_risk", "hidden_funds_found", "new_defi_position"].includes(conditionType);
  const needsDirection = needsThreshold;

  return (
    <div className="space-y-3 p-4 rounded-xl border border-border bg-surface-raised">
      <p className="text-xs font-medium text-text-mid uppercase tracking-widest">New Alert</p>

      <div className="space-y-2">
        <select
          value={conditionType}
          onChange={(e) => setConditionType(e.target.value as AlertConditionType)}
          className="w-full h-9 px-3 rounded-lg text-sm bg-surface border border-border text-text-hi focus:outline-none focus:border-accent/40"
        >
          {Object.entries(CONDITION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {needsToken && (
          <input
            type="text"
            placeholder="Token symbol (e.g. ETH)"
            value={tokenSymbol}
            onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
            className="w-full h-9 px-3 rounded-lg text-sm bg-surface border border-border text-text-hi placeholder:text-text-lo focus:outline-none focus:border-accent/40"
          />
        )}

        {needsThreshold && (
          <div className="flex gap-2">
            <input
              type="number"
              placeholder={conditionType.includes("price") ? "Target price $" : "Threshold %"}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="flex-1 h-9 px-3 rounded-lg text-sm num bg-surface border border-border text-text-hi placeholder:text-text-lo focus:outline-none focus:border-accent/40"
            />
            {needsDirection && (
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as "above" | "below")}
                className="h-9 px-2 rounded-lg text-sm bg-surface border border-border text-text-hi focus:outline-none"
              >
                <option value="below">Below</option>
                <option value="above">Above</option>
              </select>
            )}
          </div>
        )}

        <input
          type="text"
          placeholder="Custom label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full h-9 px-3 rounded-lg text-sm bg-surface border border-border text-text-hi placeholder:text-text-lo focus:outline-none focus:border-accent/40"
        />
      </div>

      <button
        onClick={handleAdd}
        className="w-full h-9 flex items-center justify-center gap-2 rounded-lg bg-accent/15 border border-accent/30 text-accent text-sm font-medium hover:bg-accent/25 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Alert Rule
      </button>
    </div>
  );
}

export function AlertsCenter({
  rules,
  events,
  unreadCount,
  emptyStateTone = "Safe",
  emptyStateTitle = "No alert rules have fired.",
  emptyStateSubtitle = "Your portfolio is still being monitored.",
  onReadAll,
  onDismiss,
  onToggleRule,
  onDeleteRule,
  onAddRule,
}: AlertsCenterProps) {
  const [showRules, setShowRules] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const activeEvents = events.filter((e) => !e.dismissed);
  const emptyToneClass = emptyStateTone === "Safe"
    ? "border-success/20 bg-success/10"
    : emptyStateTone === "Critical"
    ? "border-danger/20 bg-danger/10"
    : "border-warning/20 bg-warning/10";
  const EmptyIcon = emptyStateTone === "Safe" ? Check : AlertTriangle;
  const emptyIconClass = emptyStateTone === "Safe" ? "text-success" : emptyStateTone === "Critical" ? "text-danger" : "text-warning";

  return (
    <div className="animate-fade-in space-y-3">
      <Card noPadding className="overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-raised/30">
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent text-[9px] font-bold text-text-hi px-1">
                {unreadCount}
              </span>
            )}
            {unreadCount > 0 && (
              <button onClick={onReadAll} className="flex items-center gap-1 text-xs text-text-lo hover:text-text-mid transition-colors">
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>
          <button
            onClick={() => setShowRules((s) => !s)}
            className="flex items-center gap-1 text-xs text-text-lo hover:text-text-mid transition-colors"
          >
            <Zap className="h-3 w-3" /> Rules ({rules.length})
          </button>
        </div>

        {/* Events list */}
        {activeEvents.length === 0 ? (
          <div className="flex flex-col items-center py-10 px-4 text-center">
            <div className={cn("h-10 w-10 rounded-2xl border flex items-center justify-center mb-3", emptyToneClass)}>
              <EmptyIcon className={cn("h-5 w-5", emptyIconClass)} />
            </div>
            <p className="text-sm text-text-mid">{emptyStateTitle}</p>
            <p className="text-xs text-text-lo mt-1">{emptyStateSubtitle}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {activeEvents.slice().reverse().slice(0, 8).map((event) => (
              <div
                key={event.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 transition-colors",
                  !event.read && "bg-accent/3"
                )}
              >
                {!event.read && (
                  <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent flex-shrink-0" />
                )}
                <SeverityIcon severity={event.severity} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-hi">{event.ruleLabel}</p>
                  <p className="text-xs text-text-mid mt-0.5">{event.message}</p>
                  <p className="text-[10px] text-text-lo mt-1">
                    {new Date(event.timestamp).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => onDismiss(event.id)}
                  className="text-text-lo hover:text-text-mid transition-colors flex-shrink-0 mt-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Rules panel */}
        {showRules && (
          <div className="border-t border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-text-mid uppercase tracking-widest">Alert Rules</p>
              <button
                onClick={() => setShowAdd((s) => !s)}
                className="flex items-center gap-1 text-xs text-accent hover:text-accent transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add rule
              </button>
            </div>

            {showAdd && <AddRuleForm onAdd={onAddRule} />}

            <div className="space-y-2">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised px-3 py-2.5"
                >
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", rule.enabled ? "text-text-hi" : "text-text-lo")}>
                      {rule.label}
                    </p>
                    {rule.thresholdValue !== undefined && (
                      <p className="text-[10px] text-text-lo">
                        {rule.direction === "above" ? "↑ >" : "↓ <"} {rule.thresholdValue}
                        {rule.conditionType.includes("pct") || rule.conditionType.includes("concentration") ? "%" : "$"}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onToggleRule(rule.id)}
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-md border transition-colors",
                      rule.enabled
                        ? "text-success bg-success/8 border-success/25"
                        : "text-text-lo bg-surface border-border"
                    )}
                  >
                    {rule.enabled ? "On" : "Off"}
                  </button>
                  <button
                    onClick={() => onDeleteRule(rule.id)}
                    className="text-text-lo hover:text-danger transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
