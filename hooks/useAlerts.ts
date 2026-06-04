"use client";

import { useState, useEffect, useCallback } from "react";
import {
  loadAlertRules, loadAlertEvents, saveAlertRules, addAlertRule,
  deleteAlertRule, toggleAlertRule, markAllRead, dismissEvent,
  evaluateAlerts,
  type AlertRule, type AlertEvent,
} from "@/lib/alerts";
import type { Portfolio, PortfolioIntelligence, PerpsApiResponse } from "@/types";
import type { PortfolioSnapshot } from "@/lib/snapshots";

export function useAlerts(
  portfolio?: Portfolio,
  intelligence?: PortfolioIntelligence,
  snapshots?: PortfolioSnapshot[],
  perps?: PerpsApiResponse | null
) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);

  useEffect(() => {
    setRules(loadAlertRules());
    setEvents(loadAlertEvents());
  }, []);

  // Evaluate alerts when portfolio changes
  useEffect(() => {
    if (!portfolio || !intelligence) return;
    const fired = evaluateAlerts(
      loadAlertRules(),
      portfolio,
      intelligence,
      snapshots ?? [],
      perps
    );
    if (fired.length > 0) {
      setEvents(loadAlertEvents());
    }
  }, [portfolio, intelligence, snapshots, perps]);

  const unreadCount = events.filter((e) => !e.read && !e.dismissed).length;
  const activeEvents = events.filter((e) => !e.dismissed);

  const addRule = useCallback((rule: Omit<AlertRule, "id" | "createdAt">) => {
    const added = addAlertRule(rule);
    setRules(loadAlertRules());
    return added;
  }, []);

  const removeRule = useCallback((id: string) => {
    deleteAlertRule(id);
    setRules(loadAlertRules());
  }, []);

  const toggleRule = useCallback((id: string) => {
    toggleAlertRule(id);
    setRules(loadAlertRules());
  }, []);

  const readAll = useCallback(() => {
    markAllRead();
    setEvents(loadAlertEvents());
  }, []);

  const dismiss = useCallback((id: string) => {
    dismissEvent(id);
    setEvents(loadAlertEvents());
  }, []);

  return {
    rules,
    events: activeEvents,
    unreadCount,
    addRule,
    removeRule,
    toggleRule,
    readAll,
    dismiss,
  };
}