import type {
  PerpsApiResponse,
  Portfolio,
  PortfolioRiskSummary,
  UnifiedRiskFactor,
  UnifiedRiskState,
} from "@/types";

export const RISK_THRESHOLDS = {
  chainConcentrationPct: {
    watch: 50,
    risky: 60,
    critical: 85,
  },
  protocolConcentrationPct: {
    watch: 50,
    risky: 55,
    critical: 80,
  },
  topHoldingPct: {
    watch: 40,
    risky: 50,
    critical: 75,
  },
  stablecoinRatioPct: {
    low: {
      watchBelow: 5,
      riskyBelow: 2,
    },
    high: {
      watchAbove: 70,
      riskyAbove: 80,
      criticalAbove: 95,
    },
  },
  borrowExposurePct: {
    watch: 10,
    risky: 20,
    critical: 40,
  },
  liquidationHealthFactor: {
    watchBelow: 1.5,
    riskyBelow: 1.3,
    criticalBelow: 1.1,
  },
  perpLeverage: {
    watch: 2,
    risky: 3,
    critical: 5,
  },
  perpActivity: {
    minMarginUsd: 50,
    minNotionalUsd: 100,
    minOpenPositions: 1,
  },
  perpLiquidationDistancePct: {
    watchBelow: 15,
    riskyBelow: 8,
    criticalBelow: 3,
  },
} as const;

const RISK_STATE_PRIORITY: UnifiedRiskState[] = ["Critical", "Risky", "Watch", "Safe"];
const RISK_FACTOR_PRIORITY: Record<string, number> = {
  perp_leverage: 90,
  perp_liquidation_pressure: 85,
  liquidation_risk: 80,
  borrow_exposure: 70,
  protocol_concentration: 60,
  top_holding: 50,
  chain_concentration: 40,
  stablecoin_ratio: 30,
};

function maxState(a: UnifiedRiskState, b: UnifiedRiskState): UnifiedRiskState {
  return RISK_STATE_PRIORITY.indexOf(a) <= RISK_STATE_PRIORITY.indexOf(b) ? a : b;
}

function formatRiskStateLower(state: UnifiedRiskState): "safe" | "moderate" | "risky" | "critical" {
  switch (state) {
    case "Safe":
      return "safe";
    case "Watch":
      return "moderate";
    case "Risky":
      return "risky";
    case "Critical":
    default:
      return "critical";
  }
}

function percentageState(
  value: number,
  thresholds: { watch: number; risky: number; critical: number }
): UnifiedRiskState {
  if (value > thresholds.critical) return "Critical";
  if (value > thresholds.risky) return "Risky";
  if (value > thresholds.watch) return "Watch";
  return "Safe";
}

function riskFactorPriority(factor: UnifiedRiskFactor): number {
  const stateWeight = { Critical: 400, Risky: 300, Watch: 200, Safe: 0 }[factor.state];
  return stateWeight + (RISK_FACTOR_PRIORITY[factor.id] ?? 10) + Math.min(factor.value ?? 0, 25);
}

export function rankRiskFactors(factors: UnifiedRiskFactor[]): UnifiedRiskFactor[] {
  return [...factors]
    .map((factor) => ({ ...factor, score: riskFactorPriority(factor) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export function getCanonicalLeverageSignal(perps?: PerpsApiResponse | null) {
  if (!perps || perps.openPositionCount < RISK_THRESHOLDS.perpActivity.minOpenPositions || perps.totalAccountValue <= 0) {
    return {
      isActive: false,
      openPositions: 0,
      accountValueUsd: perps?.totalAccountValue,
      exposureUsd: 0,
      severity: "None" as const,
      label: "No active leverage",
      explanation: "No active leveraged positions detected.",
      hasLiquidationPressure: false,
      liquidationExplanation: "No immediate liquidation pressure detected.",
      impliedLeverage: 0,
      totalMarginUsed: 0,
      totalNotionalExposure: 0,
    };
  }

  const totalMarginUsed = perps.allPositions.reduce((sum, position) => sum + Math.max(position.marginUsed, 0), 0);
  const totalNotionalExposure = perps.allPositions.reduce((sum, position) => sum + Math.max(Math.abs(position.positionValue), 0), 0);
  const impliedLeverage = totalNotionalExposure / perps.totalAccountValue;
  const openPositions = perps.allPositions.filter((position) => position.status === "open").length;
  const isActive = openPositions >= RISK_THRESHOLDS.perpActivity.minOpenPositions && (
    totalMarginUsed >= RISK_THRESHOLDS.perpActivity.minMarginUsd
    || totalNotionalExposure >= RISK_THRESHOLDS.perpActivity.minNotionalUsd
  );

  const nearestLiqDistancePct = perps.allPositions
    .map((position) => position.liqDistancePct)
    .filter((distance): distance is number => typeof distance === "number" && Number.isFinite(distance))
    .sort((a, b) => a - b)[0];

  let hasLiquidationPressure = false;
  let liquidationExplanation = "No immediate liquidation pressure detected.";
  if (nearestLiqDistancePct !== undefined) {
    hasLiquidationPressure = nearestLiqDistancePct < RISK_THRESHOLDS.perpLiquidationDistancePct.watchBelow;
    liquidationExplanation =
      nearestLiqDistancePct < RISK_THRESHOLDS.perpLiquidationDistancePct.criticalBelow
        ? `A leveraged position is very close to liquidation at roughly ${nearestLiqDistancePct.toFixed(1)}% away.`
        : nearestLiqDistancePct < RISK_THRESHOLDS.perpLiquidationDistancePct.riskyBelow
        ? `A leveraged position is getting close to liquidation at roughly ${nearestLiqDistancePct.toFixed(1)}% away.`
        : nearestLiqDistancePct < RISK_THRESHOLDS.perpLiquidationDistancePct.watchBelow
        ? `A leveraged position is worth watching at roughly ${nearestLiqDistancePct.toFixed(1)}% from liquidation.`
        : "No immediate liquidation pressure detected.";
  }

  let severity: "None" | "Watch" | "Risky" | "Critical" = "None";
  if (isActive) {
    if (impliedLeverage > RISK_THRESHOLDS.perpLeverage.critical) severity = "Critical";
    else if (impliedLeverage > RISK_THRESHOLDS.perpLeverage.risky) severity = "Risky";
    else if (impliedLeverage > RISK_THRESHOLDS.perpLeverage.watch) severity = "Watch";
  }

  const label =
    !isActive
      ? "No active leverage"
      : severity === "Critical"
      ? "Critical leverage"
      : severity === "Risky"
      ? "High leverage"
      : severity === "Watch"
      ? "Moderate leverage"
      : "Active leverage";

  const explanation =
    !isActive
      ? "No active leveraged positions detected."
      : severity === "Critical"
      ? "High leverage is your main current risk."
      : severity === "Risky"
      ? "Leverage is making this wallet riskier."
      : severity === "Watch"
      ? "You have an active leveraged position."
      : "You have an active leveraged position, but it looks modest.";

  return {
    isActive,
    openPositions,
    accountValueUsd: perps.totalAccountValue,
    exposureUsd: totalNotionalExposure,
    severity,
    label,
    explanation,
    hasLiquidationPressure,
    liquidationExplanation,
    impliedLeverage,
    totalMarginUsed,
    totalNotionalExposure,
  };
}

function buildChainFactor(portfolio: Portfolio): UnifiedRiskFactor {
  const topChain = portfolio.chainAllocations[0];
  const pct = topChain?.percentage ?? 0;
  const state = percentageState(pct, RISK_THRESHOLDS.chainConcentrationPct);

  return {
    id: "chain_concentration",
    label: "Chain concentration",
    state,
    value: pct,
    progressPct: pct,
    displayValue: topChain ? `${pct.toFixed(0)}% on ${topChain.chainName}` : "No chain concentration",
    explanation: topChain
      ? state === "Safe"
        ? `Funds are spread across ${portfolio.chainAllocations.length} chains.`
        : `${pct.toFixed(0)}% of your portfolio sits on ${topChain.chainName}.`
      : "No chain concentration detected.",
    recommendation: state === "Safe" ? undefined : "Consider spreading holdings across more than one chain.",
  };
}

function buildProtocolFactor(portfolio: Portfolio): UnifiedRiskFactor {
  const topProtocol = portfolio.protocolAllocations[0];
  const pct = topProtocol?.percentage ?? 0;
  const state = percentageState(pct, RISK_THRESHOLDS.protocolConcentrationPct);

  return {
    id: "protocol_concentration",
    label: "Protocol concentration",
    state,
    value: pct,
    progressPct: pct,
    displayValue: topProtocol ? `${pct.toFixed(0)}% in ${topProtocol.protocolName}` : "No major protocol concentration",
    explanation: topProtocol
      ? state === "Safe"
        ? "DeFi positions are spread across protocols."
        : `${pct.toFixed(0)}% of your DeFi value depends on ${topProtocol.protocolName}.`
      : "No major protocol concentration detected.",
    recommendation: state === "Safe" ? undefined : "Reduce reliance on a single protocol if you can.",
  };
}

function buildHoldingFactor(portfolio: Portfolio): UnifiedRiskFactor {
  const topHolding = portfolio.aggregated[0];
  const pct = topHolding && portfolio.summary.totalUsdValue > 0
    ? (topHolding.totalUsdValue / portfolio.summary.totalUsdValue) * 100
    : 0;
  const state = percentageState(pct, RISK_THRESHOLDS.topHoldingPct);

  return {
    id: "top_holding",
    label: "Top holding",
    state,
    value: pct,
    progressPct: pct,
    displayValue: topHolding ? `${pct.toFixed(0)}% in ${topHolding.symbol}` : "No dominant holding",
    explanation: topHolding
      ? state === "Safe"
        ? `${topHolding.symbol} is your largest holding, but it is not dominating the portfolio.`
        : `${topHolding.symbol} makes up ${pct.toFixed(0)}% of your portfolio.`
      : "No dominant holding detected.",
    recommendation: state === "Safe" ? undefined : "Trim single-asset exposure if you want less concentration risk.",
  };
}

function buildStablecoinFactor(portfolio: Portfolio): UnifiedRiskFactor {
  const stableValue = portfolio.aggregated
    .filter((holding) => holding.isStablecoin)
    .reduce((sum, holding) => sum + holding.totalUsdValue, 0);
  const pct = portfolio.summary.totalUsdValue > 0
    ? (stableValue / portfolio.summary.totalUsdValue) * 100
    : 0;

  let state: UnifiedRiskState = "Safe";
  if (pct < RISK_THRESHOLDS.stablecoinRatioPct.low.riskyBelow) state = "Risky";
  else if (pct < RISK_THRESHOLDS.stablecoinRatioPct.low.watchBelow) state = "Watch";
  else if (pct > RISK_THRESHOLDS.stablecoinRatioPct.high.criticalAbove) state = "Critical";
  else if (pct > RISK_THRESHOLDS.stablecoinRatioPct.high.riskyAbove) state = "Risky";
  else if (pct > RISK_THRESHOLDS.stablecoinRatioPct.high.watchAbove) state = "Watch";

  return {
    id: "stablecoin_ratio",
    label: "Stablecoin ratio",
    state,
    value: pct,
    progressPct: pct,
    displayValue: `${pct.toFixed(0)}% in stable assets`,
    explanation:
      pct < RISK_THRESHOLDS.stablecoinRatioPct.low.riskyBelow
        ? "You have very little stablecoin buffer right now."
        : pct < RISK_THRESHOLDS.stablecoinRatioPct.low.watchBelow
        ? "Your stablecoin buffer is a bit thin."
        : pct > RISK_THRESHOLDS.stablecoinRatioPct.high.criticalAbove
        ? "Almost all of your portfolio is sitting in stablecoins."
        : pct > RISK_THRESHOLDS.stablecoinRatioPct.high.riskyAbove
        ? "A large share of your portfolio is parked in stablecoins."
        : pct > RISK_THRESHOLDS.stablecoinRatioPct.high.watchAbove
        ? "Stablecoins make up a high share of your portfolio."
        : "Your stablecoin balance looks fairly balanced.",
    recommendation:
      state === "Safe"
        ? undefined
        : pct < RISK_THRESHOLDS.stablecoinRatioPct.low.watchBelow
        ? "Keep some liquid buffer if you want more flexibility during volatility."
        : "Check whether this much stablecoin exposure still matches your goals.",
  };
}

function buildBorrowFactor(portfolio: Portfolio): UnifiedRiskFactor {
  const pct = portfolio.summary.totalUsdValue > 0
    ? (portfolio.summary.totalBorrowUsdValue / portfolio.summary.totalUsdValue) * 100
    : 0;
  const state = percentageState(pct, RISK_THRESHOLDS.borrowExposurePct);

  return {
    id: "borrow_exposure",
    label: "Borrow exposure",
    state,
    value: pct,
    progressPct: pct,
    displayValue: portfolio.summary.totalBorrowUsdValue > 0
      ? `${pct.toFixed(0)}% borrowed`
      : "No active borrows",
    explanation: portfolio.summary.totalBorrowUsdValue > 0
      ? state === "Safe"
        ? "Borrow size is modest relative to your portfolio."
        : `${portfolio.summary.totalBorrowUsdValue.toFixed(0)} USD is currently borrowed against your positions.`
      : "No active borrows detected.",
    recommendation: state === "Safe" || portfolio.summary.totalBorrowUsdValue <= 0
      ? undefined
      : "Reduce borrow size or add collateral if you want more room.",
  };
}

function buildLiquidationFactor(portfolio: Portfolio): UnifiedRiskFactor {
  const riskyProtocols = portfolio.protocols
    .filter((protocol) => protocol.totalBorrowUsd > 0 && protocol.healthFactor !== undefined && protocol.healthFactor < RISK_THRESHOLDS.liquidationHealthFactor.watchBelow)
    .sort((a, b) => (a.healthFactor ?? Infinity) - (b.healthFactor ?? Infinity));

  const topProtocol = riskyProtocols[0];
  const hf = topProtocol?.healthFactor;

  let state: UnifiedRiskState = "Safe";
  if (hf !== undefined) {
    if (hf < RISK_THRESHOLDS.liquidationHealthFactor.criticalBelow) state = "Critical";
    else if (hf < RISK_THRESHOLDS.liquidationHealthFactor.riskyBelow) state = "Risky";
    else if (hf < RISK_THRESHOLDS.liquidationHealthFactor.watchBelow) state = "Watch";
  }

  return {
    id: "liquidation_risk",
    label: "Liquidation risk",
    state,
    value: hf,
    displayValue: topProtocol && hf !== undefined
      ? `${riskyProtocols.length} position${riskyProtocols.length === 1 ? "" : "s"} at risk`
      : "No liquidation pressure",
    explanation: topProtocol && hf !== undefined
      ? state === "Critical"
        ? `${topProtocol.protocolName} is close to liquidation with a health factor of ${hf.toFixed(2)}.`
        : state === "Risky"
        ? `${topProtocol.protocolName} is nearing its liquidation threshold at ${hf.toFixed(2)} health factor.`
        : `${topProtocol.protocolName} is worth watching with a health factor of ${hf.toFixed(2)}.`
      : "No liquidation pressure detected.",
    recommendation: state === "Safe" ? undefined : "Add collateral or reduce debt to lower liquidation risk.",
  };
}

function buildPerpFactor(perps?: PerpsApiResponse | null): UnifiedRiskFactor {
  const leverage = getCanonicalLeverageSignal(perps);

  if (!leverage.isActive) {
    return {
      id: "perp_leverage",
      label: "Perp leverage",
      state: "Safe",
      value: 0,
      displayValue: "No active perp leverage",
      explanation: "No active leveraged positions detected.",
    };
  }

  let state: UnifiedRiskState = "Safe";
  if (leverage.severity === "Critical") state = "Critical";
  else if (leverage.severity === "Risky") state = "Risky";
  else if (leverage.severity === "Watch") state = "Watch";

  return {
    id: "perp_leverage",
    label: "Perp leverage",
    state,
    value: leverage.impliedLeverage,
    displayValue: `${leverage.openPositions} open · ${leverage.impliedLeverage.toFixed(1)}x implied`,
    explanation: leverage.explanation,
    recommendation: state === "Safe" ? undefined : "Reduce position size or add margin if you want less trading risk.",
  };
}

function buildPerpLiquidationFactor(perps?: PerpsApiResponse | null): UnifiedRiskFactor {
  const leverage = getCanonicalLeverageSignal(perps);
  if (!leverage.isActive || !leverage.hasLiquidationPressure) {
    return {
      id: "perp_liquidation_pressure",
      label: "Perp liquidation pressure",
      state: "Safe",
      value: 0,
      displayValue: "No immediate liquidation pressure",
      explanation: leverage.isActive
        ? leverage.liquidationExplanation ?? "No immediate liquidation pressure detected."
        : "No active leveraged positions detected.",
    };
  }

  const liqText = leverage.liquidationExplanation ?? "A leveraged position is moving closer to liquidation.";
  const distanceMatch = liqText.match(/(\d+(\.\d+)?)%/);
  const distance = distanceMatch ? Number(distanceMatch[1]) : undefined;
  let state: UnifiedRiskState = "Watch";
  if (distance !== undefined) {
    if (distance < RISK_THRESHOLDS.perpLiquidationDistancePct.criticalBelow) state = "Critical";
    else if (distance < RISK_THRESHOLDS.perpLiquidationDistancePct.riskyBelow) state = "Risky";
  }

  return {
    id: "perp_liquidation_pressure",
    label: "Perp liquidation pressure",
    state,
    value: distance,
    displayValue: distance !== undefined ? `${distance.toFixed(1)}% to liquidation` : "Pressure building",
    explanation: liqText,
    recommendation: "Reduce size or add margin if you want more liquidation room.",
  };
}

function getTopReasonForFactor(factor: UnifiedRiskFactor): string {
  switch (factor.id) {
    case "perp_leverage":
      return "High leverage is your main current risk.";
    case "perp_liquidation_pressure":
      return "A leveraged position is getting close to liquidation.";
    case "protocol_concentration":
      return "Most of your DeFi depends on one protocol.";
    case "chain_concentration":
      return "A large share of your portfolio sits on one chain.";
    case "top_holding":
      return "A large share of your portfolio depends on one holding.";
    case "liquidation_risk":
      return "At least one position is close to liquidation.";
    case "borrow_exposure":
      return "Borrow exposure is a meaningful current risk.";
    case "stablecoin_ratio":
      return factor.value !== undefined && factor.value < RISK_THRESHOLDS.stablecoinRatioPct.low.watchBelow
        ? "Your portfolio has a small cash buffer right now."
        : "Your portfolio balance leans heavily toward stable assets.";
    default:
      return factor.explanation;
  }
}

function summarizeOverallState(state: UnifiedRiskState): string {
  switch (state) {
    case "Safe":
      return "No major risks detected right now.";
    case "Watch":
      return "A few things are worth watching.";
    case "Risky":
      return "Your portfolio has some meaningful risk right now.";
    case "Critical":
      return "Your portfolio has at least one urgent risk factor.";
  }
}

export function buildUnifiedRiskSummary(
  portfolio: Portfolio,
  perps?: PerpsApiResponse | null
): PortfolioRiskSummary {
  const leverage = getCanonicalLeverageSignal(perps);
  const allFactors = [
    buildLiquidationFactor(portfolio),
    buildPerpLiquidationFactor(perps),
    buildPerpFactor(perps),
    buildProtocolFactor(portfolio),
    buildChainFactor(portfolio),
    buildHoldingFactor(portfolio),
    buildBorrowFactor(portfolio),
    buildStablecoinFactor(portfolio),
  ];

  const triggeredFactors = allFactors.filter((factor) => factor.state !== "Safe");
  const safeFactors = allFactors.filter((factor) => factor.state === "Safe");
  const sortedTriggered = rankRiskFactors(triggeredFactors);
  const rankedFactors = rankRiskFactors(allFactors);

  const overallState = sortedTriggered.reduce<UnifiedRiskState>(
    (current, factor) => maxState(current, factor.state),
    "Safe"
  );

  const topReason = overallState === "Safe"
    ? "No major risks detected right now."
    : getTopReasonForFactor(sortedTriggered[0]);

  const secondaryReasons = overallState === "Safe"
    ? []
    : sortedTriggered.slice(1, 3).map((factor) => getTopReasonForFactor(factor));

  return {
    overallState,
    topReason,
    topRiskId: sortedTriggered[0]?.id,
    topRiskLabel: sortedTriggered[0]?.label,
    topRiskExplanation: sortedTriggered[0]?.explanation,
    secondaryReasons,
    summaryCopy: summarizeOverallState(overallState),
    triggeredFactors: sortedTriggered,
    safeFactors,
    rankedFactors,
    hasAlerts: sortedTriggered.length > 0,
    leverage: {
      isActive: leverage.isActive,
      openPositions: leverage.openPositions,
      accountValueUsd: leverage.accountValueUsd,
      exposureUsd: leverage.exposureUsd,
      severity: leverage.severity,
      label: leverage.label,
      explanation: leverage.explanation,
      hasLiquidationPressure: leverage.hasLiquidationPressure,
      liquidationExplanation: leverage.liquidationExplanation,
      impliedLeverage: leverage.isActive ? leverage.impliedLeverage : undefined,
    },
  };
}

export function getRiskSummaryLine(risk: PortfolioRiskSummary): string {
  const count = risk.triggeredFactors.length;
  if (risk.overallState === "Safe") return "Safe · No major risks";
  return `${risk.overallState} · ${count} factor${count === 1 ? "" : "s"} active`;
}

export function getAlertStatusCopy(risk: PortfolioRiskSummary, alertCount: number): string {
  if (alertCount > 0) return `${alertCount} active alert${alertCount === 1 ? "" : "s"}`;
  if (risk.overallState === "Safe") return "No alert rules have fired.";
  if (risk.overallState === "Watch") return "No alert rules fired, but a few risks still need attention.";
  if (risk.overallState === "Risky") return "No alert rules fired, but the portfolio still has a risky condition.";
  return "No alert rules fired, but the portfolio still has a critical risk condition.";
}

export function getLegacyRiskLevel(state: UnifiedRiskState) {
  return formatRiskStateLower(state);
}
