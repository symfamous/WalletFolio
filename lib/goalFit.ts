import type {
  GoalFitFactor,
  GoalFitLevel,
  GoalFitRecommendation,
  GoalFitState,
  PerpsApiResponse,
  Portfolio,
  PortfolioBucketId,
  PortfolioGoal,
  PortfolioGoalFitSummary,
  PortfolioRiskSummary,
  PortfolioStressSummary,
  UnifiedRiskFactor,
  UnifiedRiskState,
} from "@/types";
import { buildPortfolioBuckets } from "./portfolioBuckets.ts";
import { buildUnifiedRiskSummary } from "./riskTruth.ts";
import { buildPortfolioStressSummary } from "./stressSummary.ts";

export const PORTFOLIO_GOALS: PortfolioGoal[] = [
  "Mostly Safe",
  "Long-Term Growth",
  "Active Trader",
  "Learn Slowly",
  "Balanced",
];

interface GoalContext {
  portfolio: Portfolio;
  risk: PortfolioRiskSummary;
  stress: PortfolioStressSummary;
  bucketShares: Record<PortfolioBucketId, number>;
  totalUsdValue: number;
  liquidRatio: number;
  limitedRatio: number;
  complexityScore: number;
  complexityLabel: string;
  concentrationState: UnifiedRiskState;
  leverageState: UnifiedRiskState;
  stablecoinState: UnifiedRiskState;
  topRiskId?: string;
  leverageIsActive: boolean;
}

interface WeightedFactor extends GoalFitFactor {
  weight: number;
  recommendation?: GoalFitRecommendation;
}

const FIT_POINTS: Record<GoalFitLevel, number> = {
  Good: 1,
  Okay: 0.58,
  Weak: 0,
};

function stateRank(state: UnifiedRiskState): number {
  return {
    Safe: 0,
    Watch: 1,
    Risky: 2,
    Critical: 3,
  }[state];
}

function worseState(a: UnifiedRiskState, b: UnifiedRiskState): UnifiedRiskState {
  return stateRank(a) >= stateRank(b) ? a : b;
}

function share(value: number, total: number): number {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

function fitStateFromScore(score: number): GoalFitState {
  if (score >= 82) return "Strong Fit";
  if (score >= 66) return "Mostly Fits";
  if (score >= 45) return "Mixed";
  return "Poor Fit";
}

function getPriority(weight: number, fit: GoalFitLevel): GoalFitRecommendation["priority"] {
  if (fit === "Weak" && weight >= 1.2) return "High";
  if (fit === "Weak" || weight >= 1) return "Medium";
  return "Low";
}

function formatGoal(goal: PortfolioGoal): string {
  return goal.toLowerCase();
}

function buildBucketShares(portfolio: Portfolio) {
  const buckets = buildPortfolioBuckets(portfolio);
  return buckets.reduce<Record<PortfolioBucketId, number>>((acc, bucket) => {
    acc[bucket.bucketId] = bucket.percentage;
    return acc;
  }, {
    safe_cash: 0,
    long_term_holds: 0,
    active_trades: 0,
    defi_earn: 0,
    locked_funds: 0,
    forgotten_dust: 0,
  });
}

function getRiskFactor(
  risk: PortfolioRiskSummary,
  id: UnifiedRiskFactor["id"]
): UnifiedRiskFactor | undefined {
  return [...risk.triggeredFactors, ...risk.safeFactors].find((factor) => factor.id === id);
}

function buildContext(portfolio: Portfolio, risk: PortfolioRiskSummary, stress: PortfolioStressSummary): GoalContext {
  const bucketShares = buildBucketShares(portfolio);
  const totalUsdValue = portfolio.summary.totalUsdValue;
  const liquidRatio = share(stress.liquidAccess.totalLiquidUsd ?? 0, totalUsdValue);
  const limitedRatio = share(stress.limitedAccess.totalLimitedUsd ?? 0, totalUsdValue);
  const complexityScore =
    portfolio.summary.activeChainCount
    + portfolio.summary.activeProtocolCount
    + Math.max(0, portfolio.aggregated.length - 4) / 2
    + (bucketShares.forgotten_dust >= 6 ? 2 : bucketShares.forgotten_dust >= 3 ? 1 : 0);
  const complexityLabel =
    complexityScore <= 3 ? "fairly simple" :
    complexityScore <= 6 ? "somewhat layered" :
    "fairly complex";

  const concentrationState = [
    getRiskFactor(risk, "top_holding")?.state ?? "Safe",
    getRiskFactor(risk, "protocol_concentration")?.state ?? "Safe",
    getRiskFactor(risk, "chain_concentration")?.state ?? "Safe",
  ].reduce(worseState, "Safe");

  return {
    portfolio,
    risk,
    stress,
    bucketShares,
    totalUsdValue,
    liquidRatio,
    limitedRatio,
    complexityScore,
    complexityLabel,
    concentrationState,
    leverageState: getRiskFactor(risk, "perp_leverage")?.state ?? "Safe",
    stablecoinState: getRiskFactor(risk, "stablecoin_ratio")?.state ?? "Safe",
    topRiskId: risk.topRiskId,
    leverageIsActive: risk.leverage.isActive,
  };
}

function factor(
  id: string,
  label: string,
  fit: GoalFitLevel,
  explanation: string,
  weight: number,
  recommendationText?: string
): WeightedFactor {
  return {
    id,
    label,
    fit,
    explanation,
    weight,
    recommendation: recommendationText ? {
      id,
      text: recommendationText,
      priority: getPriority(weight, fit),
    } : undefined,
  };
}

function evaluateMostlySafe(ctx: GoalContext): WeightedFactor[] {
  const { bucketShares, concentrationState, leverageState, liquidRatio, limitedRatio, risk, topRiskId, leverageIsActive } = ctx;

  const stableFit: GoalFitLevel =
    bucketShares.safe_cash >= 25 ? "Good" :
    bucketShares.safe_cash >= 10 ? "Okay" :
    "Weak";
  const leverageFit: GoalFitLevel =
    leverageState === "Safe" && bucketShares.active_trades <= 5 ? "Good" :
    leverageState !== "Critical" && bucketShares.active_trades <= 12 ? "Okay" :
    "Weak";
  const concentrationFit: GoalFitLevel =
    concentrationState === "Safe" ? "Good" :
    concentrationState === "Watch" ? "Okay" :
    "Weak";
  const liquidityFit: GoalFitLevel =
    liquidRatio >= 25 && limitedRatio <= 20 ? "Good" :
    liquidRatio >= 12 && limitedRatio <= 35 ? "Okay" :
    "Weak";
  const protocolFit: GoalFitLevel =
    risk.overallState === "Safe" || risk.overallState === "Watch" ? "Good" :
    risk.overallState === "Risky" ? "Okay" :
    "Weak";
  const leverageWeight = leverageIsActive && topRiskId === "perp_leverage" ? 2.4 : leverageIsActive ? 1.9 : 1.45;
  const defensiveWeight = leverageIsActive && topRiskId === "perp_leverage" ? 1.2 : 1.65;

  return [
    factor(
      "defensive-buffer",
      "Defensive buffer",
      stableFit,
      stableFit === "Good"
        ? "Your stable balance supports this goal."
        : stableFit === "Okay"
        ? "You have some defensive cash, but the buffer is still modest."
        : "Safe cash looks light for a mostly safe goal.",
      defensiveWeight,
      "Check how much of your money is truly defensive."
    ),
    factor(
      "leverage-control",
      "Leverage",
      leverageFit,
      leverageFit === "Good"
        ? "Leverage is not a major issue here."
        : leverageFit === "Okay"
        ? "Leverage is present, but not dominant."
        : "Leverage is the main mismatch for a safety-focused goal.",
      leverageWeight,
      "Review leveraged positions first."
    ),
    factor(
      "liquidity",
      "Liquidity",
      liquidityFit,
      liquidityFit === "Good"
        ? "A healthy share of the portfolio looks easy to access."
        : liquidityFit === "Okay"
        ? "Some money is liquid, but not enough to feel fully defensive."
        : "Too much of the portfolio may take extra steps to access.",
      1.2,
      "Do not treat slower money as emergency cash."
    ),
    factor(
      "concentration",
      "Concentration",
      concentrationFit,
      concentrationFit === "Good"
        ? "No single holding or venue stands out too much."
        : concentrationFit === "Okay"
        ? "One area is getting a bit large for this goal."
        : "One holding, chain, or protocol matters too much for this goal.",
      1.15,
      "Trim single-point concentration if you want a steadier setup."
    ),
    factor(
      "protocol-dependence",
      "Risk level",
      protocolFit,
      protocolFit === "Good"
        ? "Overall risk is still in a calmer range."
        : protocolFit === "Okay"
        ? "This portfolio leans a bit more aggressive than this goal."
        : "Overall risk is well above a mostly safe target.",
      1,
      "Focus on the riskiest area before adding anything new."
    ),
  ];
}

function evaluateLongTermGrowth(ctx: GoalContext): WeightedFactor[] {
  const { bucketShares, concentrationState, leverageState, stablecoinState } = ctx;
  const coreFit: GoalFitLevel =
    bucketShares.long_term_holds >= 45 ? "Good" :
    bucketShares.long_term_holds >= 30 ? "Okay" :
    "Weak";
  const tradingFit: GoalFitLevel =
    leverageState === "Safe" && bucketShares.active_trades <= 15 ? "Good" :
    leverageState !== "Critical" && bucketShares.active_trades <= 30 ? "Okay" :
    "Weak";
  const concentrationFit: GoalFitLevel =
    concentrationState === "Critical" ? "Weak" :
    concentrationState === "Risky" ? "Okay" :
    "Good";
  const cashFit: GoalFitLevel =
    stablecoinState === "Critical" ? "Weak" :
    stablecoinState === "Risky" ? "Okay" :
    "Good";
  const lockedFit: GoalFitLevel =
    bucketShares.locked_funds <= 15 ? "Good" :
    bucketShares.locked_funds <= 30 ? "Okay" :
    "Weak";

  return [
    factor(
      "core-holdings",
      "Long-term core",
      coreFit,
      coreFit === "Good"
        ? "Your regular holdings give this goal a solid base."
        : coreFit === "Okay"
        ? "You have some long-term exposure, but it is not clearly the core."
        : "This wallet does not yet have a strong long-term core.",
      1.35,
      "Make sure your long-term holdings stay the main part of this setup."
    ),
    factor(
      "trading-discipline",
      "Trading share",
      tradingFit,
      tradingFit === "Good"
        ? "Short-term trading is not crowding out the long-term plan."
        : tradingFit === "Okay"
        ? "Active trading is noticeable, but not overwhelming."
        : "Active trading is taking too much space for a long-term growth setup.",
      1.25,
      "Keep active trading from dominating a long-term portfolio."
    ),
    factor(
      "concentration",
      "Concentration",
      concentrationFit,
      concentrationFit === "Good"
        ? "Concentration still looks manageable."
        : concentrationFit === "Okay"
        ? "One area is getting large enough to watch."
        : "This portfolio leans too heavily on one area for this goal.",
      1.05,
      "Check whether one holding or protocol has become too important."
    ),
    factor(
      "cash-balance",
      "Cash balance",
      cashFit,
      cashFit === "Good"
        ? "Your stable balance does not look extreme for this goal."
        : cashFit === "Okay"
        ? "Your cash balance is leaning a bit too far to one side."
        : "Your stable balance is either too thin or too dominant for this goal.",
      0.9,
      "Keep enough dry powder without letting cash replace the long-term core."
    ),
    factor(
      "locked-share",
      "Locked funds",
      lockedFit,
      lockedFit === "Good"
        ? "Most of the portfolio still looks reasonably usable."
        : lockedFit === "Okay"
        ? "Some capital is tied up, which may slow decisions."
        : "Too much capital is tied up for a flexible long-term setup.",
      0.85,
      "Know what part of the portfolio is slower to access."
    ),
  ];
}

function evaluateActiveTrader(ctx: GoalContext): WeightedFactor[] {
  const { bucketShares, leverageState, liquidRatio, limitedRatio, complexityScore } = ctx;
  const activeFit: GoalFitLevel =
    bucketShares.active_trades >= 15 ? "Good" :
    bucketShares.active_trades >= 5 ? "Okay" :
    "Weak";
  const liquidityFit: GoalFitLevel =
    liquidRatio >= 20 ? "Good" :
    liquidRatio >= 10 ? "Okay" :
    "Weak";
  const trappedFit: GoalFitLevel =
    limitedRatio <= 15 ? "Good" :
    limitedRatio <= 30 ? "Okay" :
    "Weak";
  const riskControlFit: GoalFitLevel =
    leverageState === "Critical" ? "Weak" :
    leverageState === "Risky" ? "Okay" :
    "Good";
  const clutterFit: GoalFitLevel =
    bucketShares.forgotten_dust <= 3 && complexityScore <= 6 ? "Good" :
    bucketShares.forgotten_dust <= 7 && complexityScore <= 8 ? "Okay" :
    "Weak";

  return [
    factor(
      "active-capital",
      "Active capital",
      activeFit,
      activeFit === "Good"
        ? "This portfolio has enough active exposure for this goal."
        : activeFit === "Okay"
        ? "You have some active exposure, but not a strong trading core."
        : "There is not much active trading capital here yet.",
      1.15,
      "If this is a trading-focused setup, keep enough liquid and active capital ready."
    ),
    factor(
      "liquid-readiness",
      "Liquidity",
      liquidityFit,
      liquidityFit === "Good"
        ? "You have useful liquid capital ready to move."
        : liquidityFit === "Okay"
        ? "Some capital is ready, but flexibility is only moderate."
        : "Liquid capital looks light for an active trading goal.",
      1.35,
      "Keep more of your trading capital easy to move."
    ),
    factor(
      "trapped-capital",
      "Locked share",
      trappedFit,
      trappedFit === "Good"
        ? "Not much capital looks trapped or slow."
        : trappedFit === "Okay"
        ? "Some capital may slow you down when you want to act."
        : "Too much capital is tied up for this goal.",
      1.3,
      "Locked funds are less useful for an active trading goal."
    ),
    factor(
      "risk-control",
      "Risk control",
      riskControlFit,
      riskControlFit === "Good"
        ? "Risk is active but still reasonably controlled."
        : riskControlFit === "Okay"
        ? "Trading risk is elevated, but still manageable."
        : "Leverage is high enough to make this setup harder to manage safely.",
      1,
      "Keep leverage at a level you can manage calmly."
    ),
    factor(
      "clutter",
      "Readiness",
      clutterFit,
      clutterFit === "Good"
        ? "The wallet still looks fairly ready to act."
        : clutterFit === "Okay"
        ? "Some clutter could slow you down."
        : "Dust and clutter make this setup less ready than it looks.",
      0.9,
      "Clean up dust and low-importance balances if they are getting in the way."
    ),
  ];
}

function evaluateLearnSlowly(ctx: GoalContext): WeightedFactor[] {
  const { bucketShares, leverageState, complexityScore, portfolio, complexityLabel } = ctx;
  const simplicityFit: GoalFitLevel =
    complexityScore <= 3 ? "Good" :
    complexityScore <= 6 ? "Okay" :
    "Weak";
  const leverageFit: GoalFitLevel =
    leverageState === "Safe" ? "Good" :
    leverageState === "Watch" ? "Okay" :
    "Weak";
  const defiFit: GoalFitLevel =
    bucketShares.defi_earn + bucketShares.locked_funds <= 20 && portfolio.summary.activeProtocolCount <= 1 ? "Good" :
    bucketShares.defi_earn + bucketShares.locked_funds <= 35 && portfolio.summary.activeProtocolCount <= 2 ? "Okay" :
    "Weak";
  const clutterFit: GoalFitLevel =
    bucketShares.forgotten_dust <= 2 && portfolio.aggregated.length <= 8 ? "Good" :
    bucketShares.forgotten_dust <= 6 && portfolio.aggregated.length <= 14 ? "Okay" :
    "Weak";
  const steadyFit: GoalFitLevel =
    bucketShares.safe_cash + bucketShares.long_term_holds >= 80 ? "Good" :
    bucketShares.safe_cash + bucketShares.long_term_holds >= 65 ? "Okay" :
    "Weak";

  return [
    factor(
      "simplicity",
      "Simplicity",
      simplicityFit,
      simplicityFit === "Good"
        ? "This wallet is still fairly easy to understand."
        : simplicityFit === "Okay"
        ? `The wallet feels ${complexityLabel}, which adds some complexity.`
        : `The wallet feels ${complexityLabel}, which is more than this goal usually needs.`,
      1.35,
      "Reduce moving parts if you want this portfolio to be easier to follow."
    ),
    factor(
      "leverage",
      "Leverage",
      leverageFit,
      leverageFit === "Good"
        ? "Leverage is not getting in the way of learning."
        : leverageFit === "Okay"
        ? "A small amount of leverage adds complexity."
        : "Leverage makes this wallet harder to manage as a beginner.",
      1.4,
      "Keep leverage out of a learn-slowly setup."
    ),
    factor(
      "defi-complexity",
      "DeFi complexity",
      defiFit,
      defiFit === "Good"
        ? "Protocol exposure still looks manageable."
        : defiFit === "Okay"
        ? "Some DeFi complexity is present, but not overwhelming."
        : "Protocol sprawl adds more complexity than this goal needs.",
      1.15,
      "Keep protocol usage narrow until the wallet feels easy to understand."
    ),
    factor(
      "clutter",
      "Clutter",
      clutterFit,
      clutterFit === "Good"
        ? "Dust and wallet clutter look fairly contained."
        : clutterFit === "Okay"
        ? "A bit of clutter is building up."
        : "Dust and fragmentation are making the wallet harder to read.",
      1,
      "Clean up low-value leftovers if they are making the wallet noisy."
    ),
    factor(
      "steady-base",
      "Core structure",
      steadyFit,
      steadyFit === "Good"
        ? "Most of the portfolio sits in simpler areas."
        : steadyFit === "Okay"
        ? "The core still exists, but it is less obvious than it could be."
        : "Too much of the wallet sits in areas that are harder to follow.",
      0.95,
      "Keep most of the portfolio in simpler holdings while you learn."
    ),
  ];
}

function evaluateBalanced(ctx: GoalContext): WeightedFactor[] {
  const { bucketShares, leverageState, liquidRatio, limitedRatio, concentrationState, risk } = ctx;
  const mixFit: GoalFitLevel =
    bucketShares.safe_cash >= 10 && bucketShares.safe_cash <= 35 && bucketShares.long_term_holds >= 35 && bucketShares.long_term_holds <= 75
      ? "Good"
      : bucketShares.safe_cash >= 5 && bucketShares.safe_cash <= 45 && bucketShares.long_term_holds >= 25
      ? "Okay"
      : "Weak";
  const leverageFit: GoalFitLevel =
    leverageState === "Safe" && bucketShares.active_trades <= 10 ? "Good" :
    leverageState !== "Critical" && bucketShares.active_trades <= 20 ? "Okay" :
    "Weak";
  const liquidityFit: GoalFitLevel =
    liquidRatio >= 15 && limitedRatio <= 25 ? "Good" :
    liquidRatio >= 8 && limitedRatio <= 35 ? "Okay" :
    "Weak";
  const concentrationFit: GoalFitLevel =
    concentrationState === "Critical" ? "Weak" :
    concentrationState === "Risky" ? "Okay" :
    "Good";
  const overallRiskFit: GoalFitLevel =
    risk.overallState === "Critical" ? "Weak" :
    risk.overallState === "Risky" ? "Okay" :
    "Good";

  return [
    factor(
      "mix",
      "Portfolio mix",
      mixFit,
      mixFit === "Good"
        ? "Your mix of growth and defensive capital supports this goal."
        : mixFit === "Okay"
        ? "Some balanced elements are here, but the mix is not quite there yet."
        : "The portfolio is leaning too far to one side for a balanced goal.",
      1.25,
      "Check whether you still have enough defensive capital for a balanced setup."
    ),
    factor(
      "leverage",
      "Leverage",
      leverageFit,
      leverageFit === "Good"
        ? "Leverage is not pushing the portfolio too far off balance."
        : leverageFit === "Okay"
        ? "Leverage is noticeable, but not dominant."
        : "Leverage pushes this portfolio away from a balanced setup.",
      1.2,
      "Keep active trading exposure from overpowering the rest of the portfolio."
    ),
    factor(
      "liquidity",
      "Liquidity",
      liquidityFit,
      liquidityFit === "Good"
        ? "You have a workable mix of liquid and invested money."
        : liquidityFit === "Okay"
        ? "Liquidity is present, but thinner than ideal."
        : "Too much of the portfolio is slow to access for this goal.",
      1.05,
      "Know what part of the portfolio is ready cash and what is slower money."
    ),
    factor(
      "concentration",
      "Concentration",
      concentrationFit,
      concentrationFit === "Good"
        ? "No single area is overwhelming the whole portfolio."
        : concentrationFit === "Okay"
        ? "One area is becoming a larger bet than this goal usually wants."
        : "One area is too dominant for a balanced setup.",
      1.05,
      "Spread risk a bit more if you want a steadier balance."
    ),
    factor(
      "overall-risk",
      "Overall risk",
      overallRiskFit,
      overallRiskFit === "Good"
        ? "Overall portfolio risk still looks moderate."
        : overallRiskFit === "Okay"
        ? "Risk is leaning higher than this goal usually wants."
        : "Overall portfolio risk is well above a balanced target.",
      0.95,
      "Bring the biggest risk source back into line with the rest of the portfolio."
    ),
  ];
}

function evaluateGoal(goal: PortfolioGoal, ctx: GoalContext): WeightedFactor[] {
  switch (goal) {
    case "Mostly Safe":
      return evaluateMostlySafe(ctx);
    case "Long-Term Growth":
      return evaluateLongTermGrowth(ctx);
    case "Active Trader":
      return evaluateActiveTrader(ctx);
    case "Learn Slowly":
      return evaluateLearnSlowly(ctx);
    case "Balanced":
    default:
      return evaluateBalanced(ctx);
  }
}

function buildHeadline(goal: PortfolioGoal, fitState: GoalFitState, mismatch: WeightedFactor, aligned: WeightedFactor): string {
  if (fitState === "Strong Fit") {
    return `This portfolio matches a ${formatGoal(goal)} goal quite well.`;
  }
  if (fitState === "Mostly Fits") {
    return `${aligned.label} supports this goal, but ${mismatch.label.toLowerCase()} still needs attention.`;
  }
  if (fitState === "Mixed") {
    return `Some parts fit ${formatGoal(goal)}, but the wallet still pulls in different directions.`;
  }
  return `This portfolio currently leans away from a ${formatGoal(goal)} goal.`;
}

function pickTopMismatch(factors: WeightedFactor[]): WeightedFactor {
  return [...factors]
    .sort((a, b) => {
      const fitDelta = FIT_POINTS[a.fit] - FIT_POINTS[b.fit];
      if (fitDelta !== 0) return fitDelta;
      return b.weight - a.weight;
    })[0];
}

function preferCanonicalMismatch(
  goal: PortfolioGoal,
  ctx: GoalContext,
  mismatches: WeightedFactor[]
): WeightedFactor | null {
  if (!ctx.leverageIsActive || ctx.topRiskId !== "perp_leverage") return null;

  const leverageMismatch = mismatches.find((factor) => factor.id === "leverage" || factor.id === "leverage-control");
  if (!leverageMismatch || leverageMismatch.fit === "Good") return null;

  if (goal === "Mostly Safe" || goal === "Balanced") {
    return leverageMismatch;
  }

  if (goal === "Learn Slowly") {
    return ctx.leverageState === "Risky" || ctx.leverageState === "Critical"
      ? leverageMismatch
      : null;
  }

  return null;
}

function pickTopAligned(factors: WeightedFactor[]): WeightedFactor {
  return [...factors]
    .sort((a, b) => {
      const fitDelta = FIT_POINTS[b.fit] - FIT_POINTS[a.fit];
      if (fitDelta !== 0) return fitDelta;
      return b.weight - a.weight;
    })[0];
}

function uniqueRecommendations(factors: WeightedFactor[]): GoalFitRecommendation[] {
  const seen = new Set<string>();
  return factors
    .filter((factor) => factor.fit !== "Good" && factor.recommendation)
    .map((factor) => factor.recommendation!)
    .filter((recommendation) => {
      if (seen.has(recommendation.id)) return false;
      seen.add(recommendation.id);
      return true;
    })
    .slice(0, 3);
}

function fallbackRecommendations(goal: PortfolioGoal): GoalFitRecommendation[] {
  return [{
    id: "keep-tracking-fit",
    text: goal === "Learn Slowly"
      ? "Keep the wallet simple as you learn."
      : "Check whether your biggest positions still match this goal.",
    priority: "Low",
  }];
}

function buildMismatchSummary(goal: PortfolioGoal, ctx: GoalContext, factors: WeightedFactor[]) {
  const mismatches = factors.filter((factor) => factor.fit !== "Good");
  if (mismatches.length === 0) {
    return {
      label: "No major mismatch",
      explanation: "Nothing major is pulling this portfolio away from the goal right now.",
    };
  }
  const topMismatch = preferCanonicalMismatch(goal, ctx, mismatches) ?? pickTopMismatch(mismatches);
  return {
    label: topMismatch.label,
    explanation: topMismatch.explanation,
  };
}

function buildAlignedSummary(factors: WeightedFactor[]) {
  const aligned = factors.filter((factor) => factor.fit === "Good");
  if (aligned.length === 0) {
    return {
      label: "No strong aligned area yet",
      explanation: "This portfolio does not have one clearly supportive area for the goal yet.",
    };
  }
  const topAligned = pickTopAligned(aligned);
  return {
    label: topAligned.label,
    explanation: topAligned.explanation,
  };
}

export function buildPortfolioGoalFitSummary(
  portfolio: Portfolio,
  selectedGoal: PortfolioGoal,
  perps?: PerpsApiResponse | null
): PortfolioGoalFitSummary {
  const risk = buildUnifiedRiskSummary(portfolio, perps);
  const stress = buildPortfolioStressSummary(portfolio, perps);
  const ctx = buildContext(portfolio, risk, stress);
  const factors = evaluateGoal(selectedGoal, ctx);

  const totalWeight = factors.reduce((sum, item) => sum + item.weight, 0);
  const weightedScore = factors.reduce((sum, item) => sum + item.weight * FIT_POINTS[item.fit], 0);
  const fitScore = totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) : 50;
  const overallFitState = fitStateFromScore(fitScore);
  const topMismatch = buildMismatchSummary(selectedGoal, ctx, factors);
  const topAlignedArea = buildAlignedSummary(factors);
  const recommendations = uniqueRecommendations(factors);

  return {
    selectedGoal,
    overallFitState,
    fitScore,
    headline: buildHeadline(selectedGoal, overallFitState, pickTopMismatch(factors), pickTopAligned(factors)),
    topMismatch,
    topAlignedArea,
    recommendations: recommendations.length > 0 ? recommendations : fallbackRecommendations(selectedGoal),
    factorBreakdown: factors.map(({ id, label, fit, explanation }) => ({
      id,
      label,
      fit,
      explanation,
    })),
  };
}
