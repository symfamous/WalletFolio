import type { PortfolioGoal } from "@/types";

export const GOAL_PREFERENCE_STORAGE_KEY = "pseryte_goal_mode";
export const DEFAULT_PORTFOLIO_GOAL: PortfolioGoal = "Balanced";

function isPortfolioGoal(value: string | null): value is PortfolioGoal {
  return value === "Mostly Safe"
    || value === "Long-Term Growth"
    || value === "Active Trader"
    || value === "Learn Slowly"
    || value === "Balanced";
}

export function readGoalPreference(storage: Pick<Storage, "getItem"> | null | undefined): PortfolioGoal {
  const value = storage?.getItem(GOAL_PREFERENCE_STORAGE_KEY) ?? null;
  return isPortfolioGoal(value) ? value : DEFAULT_PORTFOLIO_GOAL;
}

export function writeGoalPreference(
  storage: Pick<Storage, "setItem"> | null | undefined,
  goal: PortfolioGoal
) {
  storage?.setItem(GOAL_PREFERENCE_STORAGE_KEY, goal);
}
