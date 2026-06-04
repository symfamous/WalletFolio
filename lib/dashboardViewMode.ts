import type { DashboardViewMode, DashboardViewSections } from "@/types";

export const DEFAULT_DASHBOARD_VIEW_MODE: DashboardViewMode = "full";
const DASHBOARD_VIEW_MODE_STORAGE_KEY = "folio_dashboard_view_mode";

const FULL_VIEW_SECTIONS: DashboardViewSections = {
  checkup: true,
  goalMode: true,
  buckets: true,
  riskMonitor: true,
  behaviorInsights: true,
  portfolioIntelligence: true,
  stressEntry: true,
  activityFeed: true,
  detailedHoldings: true,
  detailedDefi: true,
  detailedPerps: true,
  alerts: true,
  hiddenFunds: true,
  timeline: true,
  targetCalculator: true,
};

export function getDashboardViewSections(_mode: DashboardViewMode): DashboardViewSections {
  return FULL_VIEW_SECTIONS;
}

export function readDashboardViewMode(_storage?: Pick<Storage, "getItem"> | null): DashboardViewMode {
  return DEFAULT_DASHBOARD_VIEW_MODE;
}

export function writeDashboardViewMode(
  storage: Pick<Storage, "setItem">,
  _mode: DashboardViewMode
) {
  storage.setItem(DASHBOARD_VIEW_MODE_STORAGE_KEY, DEFAULT_DASHBOARD_VIEW_MODE);
}

export function getActivityFeedModeForDashboard(_mode: DashboardViewMode) {
  return {
    defaultViewMode: "explained" as const,
    allowRawToggle: true,
    compact: false,
  };
}
