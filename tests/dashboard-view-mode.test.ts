import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DASHBOARD_VIEW_MODE,
  getActivityFeedModeForDashboard,
  getDashboardViewSections,
  readDashboardViewMode,
  writeDashboardViewMode,
} from "../lib/dashboardViewMode.ts";

test("Dashboard view mode is locked to full", () => {
  const storage = new Map<string, string>();
  const mockStorage = {
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
  };

  assert.equal(DEFAULT_DASHBOARD_VIEW_MODE, "full");
  assert.equal(readDashboardViewMode(mockStorage), "full");

  writeDashboardViewMode(mockStorage, "full");
  assert.equal(readDashboardViewMode(mockStorage), "full");

  writeDashboardViewMode(mockStorage, "simple");
  assert.equal(readDashboardViewMode(mockStorage), "full");
});

test("Dashboard sections always expose the full workspace surface", () => {
  const sectionsFromFull = getDashboardViewSections("full");
  const sectionsFromSimple = getDashboardViewSections("simple");

  assert.deepEqual(sectionsFromSimple, sectionsFromFull);
  assert.equal(sectionsFromFull.portfolioIntelligence, true);
  assert.equal(sectionsFromFull.detailedHoldings, true);
  assert.equal(sectionsFromFull.detailedDefi, true);
  assert.equal(sectionsFromFull.detailedPerps, true);
  assert.equal(sectionsFromFull.alerts, true);
  assert.equal(sectionsFromFull.hiddenFunds, true);
  assert.equal(sectionsFromFull.timeline, true);
  assert.equal(sectionsFromFull.targetCalculator, true);
});

test("Activity feed config always uses full-mode behavior", () => {
  assert.deepEqual(getActivityFeedModeForDashboard("full"), {
    defaultViewMode: "explained",
    allowRawToggle: true,
    compact: false,
  });

  assert.deepEqual(getActivityFeedModeForDashboard("simple"), {
    defaultViewMode: "explained",
    allowRawToggle: true,
    compact: false,
  });
});
