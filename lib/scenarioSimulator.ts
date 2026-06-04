import { buildPortfolio } from "./aggregate/portfolio.ts";
import { buildPortfolioGoalFitSummary, PORTFOLIO_GOALS } from "./goalFit.ts";
import { buildProtocolPositions } from "./normalize/protocols.ts";
import { buildPortfolioBuckets } from "./portfolioBuckets.ts";
import { buildUnifiedRiskSummary } from "./riskTruth.ts";
import { buildPortfolioStressSummary } from "./stressSummary.ts";
import type {
  AggregatedHolding,
  NormalizedPosition,
  PerpsApiResponse,
  Portfolio,
  PortfolioGoal,
  PortfolioScenarioDefinition,
  PortfolioScenarioResult,
  PortfolioScenarioType,
  UnifiedRiskState,
} from "../types/index.ts";

const DEFAULT_SCENARIO_GOAL: PortfolioGoal = "Balanced";
const DEFAULT_STABLE_SYMBOL = "USDC";
const DEFAULT_STABLE_NAME = "USD Coin";
const NON_ZERO_DELTA_USD = 0.01;
const MIN_PROTOCOL_SCENARIO_USD = 100;
const MIN_LIQUIDITY_SCENARIO_USD = 100;
const MIN_VOLATILE_SCENARIO_SHARE_PCT = 5;
const MAX_SCENARIOS = 6;

type InternalScenarioKind =
  | { kind: "close_leverage" }
  | { kind: "increase_stables"; share: number }
  | { kind: "asset_drop"; symbols: string[]; displaySymbol: string; shockPct: number }
  | { kind: "exit_protocol"; protocolId: string; protocolName: string }
  | { kind: "unlock_liquidity"; share: number };

type InternalScenarioDefinition = PortfolioScenarioDefinition & InternalScenarioKind;

function clonePosition(position: NormalizedPosition, overrides: Partial<NormalizedPosition> = {}): NormalizedPosition {
  return { ...position, ...overrides };
}

function formatPctLabel(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(0)}%`;
}

function getAllPositions(portfolio: Portfolio): NormalizedPosition[] {
  return [...portfolio.walletPositions, ...portfolio.defiPositions, ...portfolio.liabilities];
}

function buildSimulatedPortfolio(address: string, positions: NormalizedPosition[]): Portfolio {
  return buildPortfolio(
    address,
    positions,
    buildProtocolPositions(positions.filter((position) => position.source === "defi"))
  );
}

function createSyntheticStablePosition(base: NormalizedPosition | undefined, usdValue: number, id: string): NormalizedPosition {
  const chainSlug = base?.chainSlug ?? "ethereum";
  const chainName = base?.chainName ?? "Ethereum";
  const chainColor = base?.chainColor ?? "#627EEA";
  const chainEmoji = base?.chainEmoji ?? "⬡";

  return {
    id,
    symbol: DEFAULT_STABLE_SYMBOL,
    name: DEFAULT_STABLE_NAME,
    logo: undefined,
    contractAddress: `scenario-usdc-${chainSlug}`,
    decimals: 6,
    fungibleId: undefined,
    coingeckoId: "usd-coin",
    chainSlug,
    chainName,
    chainNumericId: base?.chainNumericId,
    chainColor,
    chainEmoji,
    balance: usdValue,
    rawBalance: String(usdValue),
    price: 1,
    priceChange24h: 0,
    usdValue,
    priceAvailable: true,
    source: "wallet",
    positionType: "wallet",
    isLiability: false,
    isNative: false,
    isStablecoin: true,
    isSpam: false,
    isVerified: true,
    dataSource: base?.dataSource ?? "zerion",
  };
}

function syncPerpEquityPosition(
  positions: NormalizedPosition[],
  perps: PerpsApiResponse | null | undefined
): NormalizedPosition[] {
  if (!perps) return positions;

  return positions.map((position) => {
    if (position.protocolId !== "hyperliquid-perps") return position;
    const nextUsdValue = Math.max(0, perps.totalAccountValue);
    return clonePosition(position, {
      usdValue: nextUsdValue,
      balance: nextUsdValue,
      rawBalance: String(nextUsdValue),
      price: 1,
      priceChange24h: 0,
      isStablecoin: false,
    });
  });
}

function clonePerps(perps?: PerpsApiResponse | null): PerpsApiResponse | null {
  if (!perps) return null;
  return {
    ...perps,
    platforms: perps.platforms.map((platform) => ({
      ...platform,
      positions: platform.positions.map((position) => ({ ...position })),
      accountSummary: platform.accountSummary ? { ...platform.accountSummary } : null,
      pnl: {
        ...platform.pnl,
        pnlByMarket: platform.pnl.pnlByMarket.map((item) => ({ ...item })),
      },
    })),
    allPositions: perps.allPositions.map((position) => ({ ...position })),
  };
}

function closePerps(perps?: PerpsApiResponse | null): PerpsApiResponse | null {
  if (!perps) return null;
  return {
    ...perps,
    platforms: perps.platforms.map((platform) => ({
      ...platform,
      positions: [],
      accountSummary: platform.accountSummary
        ? { ...platform.accountSummary, totalMarginUsed: 0, totalNtlPos: 0 }
        : null,
    })),
    allPositions: [],
    totalUnrealizedPnl: 0,
    openPositionCount: 0,
    hasAnyPositions: perps.hasAnyPositions,
  };
}

function applyAssetShockToPerps(
  perps: PerpsApiResponse | null,
  matchSymbol: (symbol: string) => boolean,
  shockPct: number
): PerpsApiResponse | null {
  if (!perps) return null;

  const next = clonePerps(perps);
  if (!next) return null;

  let totalPnlDelta = 0;
  next.allPositions = next.allPositions.map((position) => {
    if (position.status !== "open" || !matchSymbol(position.coin)) return position;
    const signedShock = position.side === "long" ? shockPct : -shockPct;
    const pnlDelta = position.positionValue * signedShock;
    totalPnlDelta += pnlDelta;
    const nextMarkPrice = position.markPrice * (1 + shockPct);
    const nextPositionValue = Math.max(0, position.positionValue * (1 + shockPct));
    const liqDistancePct =
      typeof position.liqDistancePct === "number" && position.side === "long" && shockPct < 0
        ? Math.max(0, position.liqDistancePct + shockPct * 100)
        : position.liqDistancePct;

    return {
      ...position,
      markPrice: nextMarkPrice,
      positionValue: nextPositionValue,
      unrealizedPnl: position.unrealizedPnl + pnlDelta,
      liqDistancePct,
    };
  });

  next.totalUnrealizedPnl += totalPnlDelta;
  next.totalAccountValue = Math.max(0, next.totalAccountValue + totalPnlDelta);
  next.platforms = next.platforms.map((platform) => ({
    ...platform,
    positions: platform.positions.map((position) => {
      const updated = next.allPositions.find((item) => item.market === position.market && item.coin === position.coin);
      return updated ?? position;
    }),
    accountSummary: platform.accountSummary
      ? {
          ...platform.accountSummary,
          accountValue: Math.max(0, platform.accountSummary.accountValue + totalPnlDelta),
          totalNtlPos: next.allPositions.reduce((sum, position) => sum + Math.abs(position.positionValue), 0),
        }
      : null,
  }));

  return next;
}

function buildBucketDeltas(before: Portfolio, after: Portfolio) {
  const beforeBuckets = buildPortfolioBuckets(before);
  const afterBuckets = buildPortfolioBuckets(after);
  const beforeMap = new Map(beforeBuckets.map((bucket) => [bucket.bucketId, bucket]));

  return afterBuckets
    .map((bucket) => {
      const previous = beforeMap.get(bucket.bucketId);
      return {
        bucket: bucket.label,
        deltaUsd: bucket.totalUsdValue - (previous?.totalUsdValue ?? 0),
        deltaPctPoints: bucket.percentage - (previous?.percentage ?? 0),
      };
    })
    .filter((bucket) => Math.abs(bucket.deltaUsd) >= NON_ZERO_DELTA_USD)
    .sort((a, b) => Math.abs(b.deltaUsd) - Math.abs(a.deltaUsd));
}

function summarizeRiskDelta(
  before: ReturnType<typeof buildUnifiedRiskSummary>,
  after: ReturnType<typeof buildUnifiedRiskSummary>
) {
  if (before.overallState === after.overallState) {
    return {
      before: before.overallState,
      after: after.overallState,
      summary: after.overallState === "Safe"
        ? "Estimated overall risk stays calm."
        : `Estimated overall risk stays ${after.overallState.toLowerCase()}.`,
    };
  }

  return {
    before: before.overallState,
    after: after.overallState,
    summary:
      after.overallState === "Safe" || after.overallState === "Watch"
        ? `Estimated overall risk improves from ${before.overallState} to ${after.overallState}.`
        : `Estimated overall risk worsens from ${before.overallState} to ${after.overallState}.`,
  };
}

function summarizeGoalFitDelta(
  before: ReturnType<typeof buildPortfolioGoalFitSummary>,
  after: ReturnType<typeof buildPortfolioGoalFitSummary>
) {
  return {
    goal: after.selectedGoal,
    before: before.overallFitState,
    after: after.overallFitState,
    summary:
      before.overallFitState === after.overallFitState
        ? `Estimated fit stays ${after.overallFitState.toLowerCase()} for ${after.selectedGoal.toLowerCase()}.`
        : `Estimated fit moves from ${before.overallFitState} to ${after.overallFitState} for ${after.selectedGoal.toLowerCase()}.`,
  };
}

function summarizeLiquidityDelta(
  before: ReturnType<typeof buildPortfolioStressSummary>,
  after: ReturnType<typeof buildPortfolioStressSummary>
) {
  const defensiveCashDeltaUsd = (after.defensiveCash.totalUsd ?? 0) - (before.defensiveCash.totalUsd ?? 0);
  const quickExitDeltaUsd = (after.quickToSell.totalUsd ?? 0) - (before.quickToSell.totalUsd ?? 0);
  const slowerAccessDeltaUsd = (after.limitedAccess.totalLimitedUsd ?? 0) - (before.limitedAccess.totalLimitedUsd ?? 0);

  let summary = "Estimated liquidity mix stays similar.";
  if (defensiveCashDeltaUsd > NON_ZERO_DELTA_USD) {
    summary = "This would likely add more defensive cash.";
  } else if (slowerAccessDeltaUsd < -NON_ZERO_DELTA_USD) {
    summary = "This would likely make more money easier to access.";
  } else if (quickExitDeltaUsd > NON_ZERO_DELTA_USD) {
    summary = "This would likely add more quick-exit money.";
  } else if (slowerAccessDeltaUsd > NON_ZERO_DELTA_USD) {
    summary = "This would likely leave more money in slower-access positions.";
  }

  return {
    defensiveCashDeltaUsd,
    quickExitDeltaUsd,
    slowerAccessDeltaUsd,
    summary,
  };
}

function estimateValueDelta(before: Portfolio, after: Portfolio) {
  const deltaUsd = after.summary.totalUsdValue - before.summary.totalUsdValue;
  const deltaPct = before.summary.totalUsdValue > 0
    ? (deltaUsd / before.summary.totalUsdValue) * 100
    : 0;

  return { deltaUsd, deltaPct };
}

function aggregateRiskWeight(state: UnifiedRiskState): number {
  return { Safe: 0, Watch: 1, Risky: 2, Critical: 3 }[state];
}

function getMeaningfulVolatileHoldings(portfolio: Portfolio): AggregatedHolding[] {
  const total = portfolio.summary.totalUsdValue;
  return portfolio.aggregated
    .filter((holding) => !holding.isStablecoin)
    .filter((holding) => holding.totalUsdValue >= MIN_PROTOCOL_SCENARIO_USD)
    .filter((holding) => total > 0 && (holding.totalUsdValue / total) * 100 >= MIN_VOLATILE_SCENARIO_SHARE_PCT)
    .slice(0, 3);
}

function getTopDefiProtocol(portfolio: Portfolio) {
  return portfolio.protocolAllocations[0] ?? portfolio.protocols[0];
}

function getBucketShares(portfolio: Portfolio) {
  return Object.fromEntries(buildPortfolioBuckets(portfolio).map((bucket) => [bucket.bucketId, bucket.percentage])) as Record<string, number>;
}

function chooseGoal(selectedGoal?: PortfolioGoal): PortfolioGoal {
  return selectedGoal && PORTFOLIO_GOALS.includes(selectedGoal) ? selectedGoal : DEFAULT_SCENARIO_GOAL;
}

function buildAssetDropScenario(holding: AggregatedHolding, shockPct: number, priority: number): InternalScenarioDefinition {
  return {
    id: `asset-drop:${holding.symbol}:${Math.abs(shockPct)}`,
    type: "asset_drop",
    kind: "asset_drop",
    symbols: [holding.symbol.toUpperCase()],
    displaySymbol: holding.symbol.toUpperCase(),
    shockPct,
    title: `What if ${holding.symbol.toUpperCase()} drops ${Math.abs(shockPct)}%?`,
    description: `Estimate the directional hit if ${holding.symbol.toUpperCase()} falls from here.`,
    priority,
    reasonGenerated: `${holding.symbol.toUpperCase()} is one of your biggest non-stable holdings.`,
  };
}

function buildIncreaseStablesScenario(priority: number): InternalScenarioDefinition {
  return {
    id: "increase-stables:20",
    type: "increase_stables",
    kind: "increase_stables",
    share: 0.2,
    title: "What if I move 20% into stables?",
    description: "Estimate the effect of shifting part of your liquid holdings into stablecoins.",
    priority,
    reasonGenerated: "Your defensive cash looks light for your current risk and liquidity profile.",
  };
}

function buildCloseLeverageScenario(priority: number): InternalScenarioDefinition {
  return {
    id: "close-leverage",
    type: "close_leverage",
    kind: "close_leverage",
    title: "What if I close my leveraged position?",
    description: "Estimate the effect of closing your current leveraged exposure now.",
    priority,
    reasonGenerated: "Active leverage is a meaningful current risk in this wallet.",
  };
}

function buildExitProtocolScenario(protocolId: string, protocolName: string, priority: number): InternalScenarioDefinition {
  return {
    id: `exit-protocol:${protocolId}`,
    type: "exit_protocol",
    kind: "exit_protocol",
    protocolId,
    protocolName,
    title: `What if I exit ${protocolName}?`,
    description: `Estimate the effect of withdrawing your largest tracked protocol exposure from ${protocolName}.`,
    priority,
    reasonGenerated: `${protocolName} is your biggest tracked protocol exposure right now.`,
  };
}

function buildUnlockLiquidityScenario(priority: number): InternalScenarioDefinition {
  return {
    id: "unlock-liquidity",
    type: "unlock_liquidity",
    kind: "unlock_liquidity",
    share: 0.35,
    title: "What if more of my money were easier to access?",
    description: "Estimate the effect of reducing slower-access positions and moving them into easier exits.",
    priority,
    reasonGenerated: "A meaningful share of your money is slower to access right now.",
  };
}

function buildAdaptiveScenarioDefinitions(
  portfolio: Portfolio,
  selectedGoal?: PortfolioGoal,
  perps?: PerpsApiResponse | null
): InternalScenarioDefinition[] {
  const goal = chooseGoal(selectedGoal);
  const risk = buildUnifiedRiskSummary(portfolio, perps);
  const stress = buildPortfolioStressSummary(portfolio, perps);
  const bucketShares = getBucketShares(portfolio);
  const holdings = getMeaningfulVolatileHoldings(portfolio);
  const protocol = getTopDefiProtocol(portfolio);
  const scenarios: InternalScenarioDefinition[] = [];

  const goalBias = {
    "Mostly Safe": { leverage: 24, stables: 20, protocol: 16, liquidity: 14, asset: 12 },
    "Balanced": { leverage: 22, stables: 16, protocol: 14, liquidity: 12, asset: 14 },
    "Learn Slowly": { leverage: 20, stables: 12, protocol: 14, liquidity: 16, asset: 10 },
    "Long-Term Growth": { leverage: 14, stables: 10, protocol: 12, liquidity: 10, asset: 18 },
    "Active Trader": { leverage: 12, stables: 6, protocol: 10, liquidity: 18, asset: 14 },
  }[goal];

  if (risk.leverage.isActive) {
    const leverageTopRiskBoost = risk.topRiskId === "perp_leverage" ? 26 : 12;
    const safetyGoalBoost = ["Mostly Safe", "Balanced", "Learn Slowly"].includes(goal) ? 18 : 0;
    scenarios.push(buildCloseLeverageScenario(
      75
      + aggregateRiskWeight(
        risk.leverage.severity === "Critical"
          ? "Critical"
          : risk.leverage.severity === "Risky"
            ? "Risky"
            : risk.leverage.severity === "Watch"
              ? "Watch"
              : "Safe"
      ) * 10
      + goalBias.leverage
      + leverageTopRiskBoost
      + safetyGoalBoost
    ));
  }

  holdings.slice(0, 2).forEach((holding, index) => {
    const shockPct = index === 0 ? -20 : -15;
    const sharePct = portfolio.summary.totalUsdValue > 0 ? (holding.totalUsdValue / portfolio.summary.totalUsdValue) * 100 : 0;
    const safetyAssetPenalty = ["Mostly Safe", "Balanced", "Learn Slowly"].includes(goal) ? 10 : 0;
    scenarios.push(buildAssetDropScenario(
      holding,
      shockPct,
      40 + Math.round(sharePct) + goalBias.asset - index * 4 - safetyAssetPenalty
    ));
  });

  if ((bucketShares.safe_cash ?? 0) < 18 || (goal === "Mostly Safe" && (bucketShares.safe_cash ?? 0) < 28)) {
    scenarios.push(buildIncreaseStablesScenario(
      38 + aggregateRiskWeight(risk.overallState) * 6 + goalBias.stables
    ));
  }

  if (protocol && ((protocol.netUsdValue ?? 0) >= MIN_PROTOCOL_SCENARIO_USD)) {
    const protocolShare = portfolio.summary.totalUsdValue > 0 ? ((protocol.netUsdValue ?? 0) / portfolio.summary.totalUsdValue) * 100 : 0;
    if (protocolShare >= 10 || risk.topRiskId === "protocol_concentration") {
      scenarios.push(buildExitProtocolScenario(
        protocol.protocolId,
        protocol.protocolName,
        34 + Math.round(protocolShare) + goalBias.protocol
      ));
    }
  }

  if ((stress.limitedAccess.totalLimitedUsd ?? 0) >= MIN_LIQUIDITY_SCENARIO_USD && (bucketShares.locked_funds ?? 0) + (bucketShares.defi_earn ?? 0) >= 12) {
    scenarios.push(buildUnlockLiquidityScenario(
      32 + Math.round(((stress.limitedAccess.totalLimitedUsd ?? 0) / Math.max(portfolio.summary.totalUsdValue, 1)) * 100) + goalBias.liquidity
    ));
  }

  if (scenarios.length === 0) {
    const fallbackHolding = portfolio.aggregated.find((holding) => !holding.isStablecoin && holding.totalUsdValue > 0);
    if (fallbackHolding) {
      scenarios.push(buildAssetDropScenario(fallbackHolding, -15, 40));
    } else {
      scenarios.push(buildIncreaseStablesScenario(30));
    }
  }

  const deduped = new Map<string, InternalScenarioDefinition>();
  for (const scenario of scenarios) {
    if (!deduped.has(scenario.id)) deduped.set(scenario.id, scenario);
  }

  return [...deduped.values()]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_SCENARIOS);
}

function applyStableShift(
  portfolio: Portfolio,
  share: number
): { portfolio: Portfolio; assumptions: string[] } {
  const allPositions = getAllPositions(portfolio);
  const eligible = portfolio.walletPositions
    .filter((position) => !position.isStablecoin)
    .filter((position) => (position.usdValue ?? 0) > 0)
    .filter((position) => position.protocolId !== "hyperliquid-perps");
  const eligibleUsd = eligible.reduce((sum, position) => sum + (position.usdValue ?? 0), 0);
  const moveUsd = eligibleUsd * share;

  if (moveUsd <= 0) {
    return {
      portfolio,
      assumptions: [
        "This estimate only shifts liquid wallet holdings, and this wallet does not have enough eligible non-stable value right now.",
        "Fees, slippage, taxes, and bridge steps are not modeled.",
      ],
    };
  }

  const adjusted = allPositions.map((position) => {
    if (!eligible.some((item) => item.id === position.id)) return position;
    const usdValue = position.usdValue ?? 0;
    const reduction = moveUsd * (usdValue / eligibleUsd);
    const factor = usdValue > 0 ? Math.max(0, (usdValue - reduction) / usdValue) : 1;
    return clonePosition(position, {
      usdValue: Math.max(0, usdValue - reduction),
      balance: position.balance * factor,
      rawBalance: String(position.balance * factor),
    });
  });

  adjusted.push(createSyntheticStablePosition(eligible[0] ?? portfolio.walletPositions[0], moveUsd, "scenario-stable-shift"));

  return {
    portfolio: buildSimulatedPortfolio(portfolio.address, adjusted),
    assumptions: [
      `This estimate shifts ${Math.round(share * 100)}% of eligible liquid wallet holdings into stablecoins.`,
      "Locked funds, DeFi positions, and active perp exposure stay untouched.",
      "Fees, slippage, and taxes are not modeled.",
    ],
  };
}

function applyCloseLeverage(
  portfolio: Portfolio,
  perps: PerpsApiResponse | null | undefined
): { portfolio: Portfolio; perps: PerpsApiResponse | null; assumptions: string[] } {
  const currentEquity = portfolio.walletPositions.find((position) => position.protocolId === "hyperliquid-perps");
  const nextPositions = getAllPositions(portfolio).flatMap((position) => {
    if (position.protocolId !== "hyperliquid-perps") return [position];
    const stable = createSyntheticStablePosition(position, position.usdValue ?? 0, `${position.id}-closed`);
    return (position.usdValue ?? 0) > 0 ? [stable] : [];
  });

  return {
    portfolio: buildSimulatedPortfolio(portfolio.address, nextPositions),
    perps: closePerps(perps),
    assumptions: [
      "This estimate treats your leveraged position as closed now at its current marked account value.",
      "Current perp equity is modeled as returning to wallet cash.",
      "Fees, slippage, and taxes are not modeled.",
      currentEquity ? "If your real settlement asset differs, the bucket result could differ." : "If no tracked perp equity is present, the value effect is treated as minimal.",
    ],
  };
}

function applyAssetShock(
  portfolio: Portfolio,
  perps: PerpsApiResponse | null | undefined,
  symbols: string[],
  shockPct: number
): { portfolio: Portfolio; perps: PerpsApiResponse | null; assumptions: string[] } {
  const shockedPerps = applyAssetShockToPerps(clonePerps(perps), (symbol) => symbols.includes(symbol.toUpperCase()), shockPct / 100);
  const shockedPositions = syncPerpEquityPosition(
    getAllPositions(portfolio).map((position) => {
      if (!symbols.includes(position.symbol.toUpperCase())) return position;
      const currentUsd = position.usdValue ?? 0;
      const nextUsd = Math.max(0, currentUsd * (1 + shockPct / 100));
      return clonePosition(position, {
        usdValue: nextUsd,
        price: position.price !== undefined ? Math.max(0, position.price * (1 + shockPct / 100)) : undefined,
      });
    }),
    shockedPerps
  );

  return {
    portfolio: buildSimulatedPortfolio(portfolio.address, shockedPositions),
    perps: shockedPerps,
    assumptions: [
      `This estimate applies a simple ${formatPctLabel(shockPct)} price shock to tracked ${symbols[0]} exposure.`,
      "It uses current portfolio composition and does not model second-order reactions, fees, or taxes.",
      "Wrapped versions only count when they already exist in canonical tracked positions.",
    ],
  };
}

function applyExitProtocol(portfolio: Portfolio, protocolId: string): { portfolio: Portfolio; assumptions: string[] } {
  const adjusted = getAllPositions(portfolio).map((position) => {
    if (position.source !== "defi" || position.protocolId !== protocolId || position.isLiability) {
      return position;
    }
    return clonePosition(position, {
      source: "wallet",
      positionType: "wallet",
      protocolId: undefined,
      protocolName: undefined,
    });
  });

  return {
    portfolio: buildSimulatedPortfolio(portfolio.address, adjusted),
    assumptions: [
      "This estimate treats the largest tracked protocol position as withdrawn back to the wallet.",
      "Returned assets keep their current tracked token mix unless exact unwind details are known.",
      "Borrow unwind, withdrawal delays, fees, and slippage are not modeled.",
    ],
  };
}

function applyUnlockLiquidity(portfolio: Portfolio, share: number): { portfolio: Portfolio; assumptions: string[] } {
  const slowPositions = portfolio.defiPositions.filter((position) =>
    !position.isLiability && ["deposit", "staked", "locked", "reward", "lp"].includes(position.positionType)
  );
  const totalSlowUsd = slowPositions.reduce((sum, position) => sum + (position.usdValue ?? 0), 0);
  const moveUsd = totalSlowUsd * share;

  if (moveUsd <= 0) {
    return {
      portfolio,
      assumptions: [
        "This wallet does not have enough slower-access money to model a useful liquidity shift.",
        "Fees, taxes, and exact protocol withdrawal paths are not modeled.",
      ],
    };
  }

  let remaining = moveUsd;
  const adjusted = getAllPositions(portfolio).flatMap((position) => {
    if (position.source !== "defi" || position.isLiability || remaining <= 0) return [position];
    if (!["deposit", "staked", "locked", "reward", "lp"].includes(position.positionType)) return [position];

    const usdValue = position.usdValue ?? 0;
    const movedUsd = Math.min(usdValue, remaining);
    remaining -= movedUsd;
    const keptUsd = Math.max(0, usdValue - movedUsd);
    const keptFactor = usdValue > 0 ? keptUsd / usdValue : 1;
    const result: NormalizedPosition[] = [];

    if (keptUsd > NON_ZERO_DELTA_USD) {
      result.push(clonePosition(position, {
        usdValue: keptUsd,
        balance: position.balance * keptFactor,
        rawBalance: String(position.balance * keptFactor),
      }));
    }

    if (movedUsd > NON_ZERO_DELTA_USD) {
      result.push(clonePosition(position, {
        id: `${position.id}-liquid`,
        source: "wallet",
        positionType: "wallet",
        protocolId: undefined,
        protocolName: undefined,
        usdValue: movedUsd,
        balance: position.balance * (usdValue > 0 ? movedUsd / usdValue : 1),
        rawBalance: String(position.balance * (usdValue > 0 ? movedUsd / usdValue : 1)),
      }));
    }

    return result;
  });

  return {
    portfolio: buildSimulatedPortfolio(portfolio.address, adjusted),
    assumptions: [
      "This estimate shifts part of slower-access money into easier wallet exits.",
      "It does not assume everything becomes stable cash, only easier to access.",
      "Fees, taxes, and exact protocol withdrawal paths are not modeled.",
    ],
  };
}

function buildTakeaway(
  definition: InternalScenarioDefinition,
  before: Portfolio,
  afterRisk: ReturnType<typeof buildUnifiedRiskSummary>,
  beforeStress: ReturnType<typeof buildPortfolioStressSummary>,
  afterStress: ReturnType<typeof buildPortfolioStressSummary>
): string {
  switch (definition.kind) {
    case "close_leverage":
      return afterRisk.topRiskId !== "perp_leverage"
        ? "Closing leverage would likely remove your biggest current risk."
        : "Closing leverage would likely reduce trading risk, even if other risks remain.";
    case "increase_stables":
      return (afterStress.defensiveCash.totalUsd ?? 0) > (beforeStress.defensiveCash.totalUsd ?? 0)
        ? "This would likely improve your defensive cash buffer."
        : "This would likely make the wallet a bit steadier, but its main holdings would still drive risk.";
    case "asset_drop": {
      const weight = before.summary.totalUsdValue > 0
        ? (before.aggregated
            .filter((holding) => definition.symbols.includes(holding.symbol.toUpperCase()))
            .reduce((sum, holding) => sum + holding.totalUsdValue, 0) / before.summary.totalUsdValue) * 100
        : 0;
      return `${definition.displaySymbol} matters because it is about ${weight.toFixed(0)}% of your tracked wallet right now.`;
    }
    case "exit_protocol":
      return (afterStress.limitedAccess.totalLimitedUsd ?? 0) < (beforeStress.limitedAccess.totalLimitedUsd ?? 0)
        ? `Exiting ${definition.protocolName} would likely make more of your money easier to access.`
        : `Exiting ${definition.protocolName} would likely cut protocol dependence, even if access does not change much.`;
    case "unlock_liquidity":
      return "Making more of your money easier to access would likely improve flexibility during stress.";
  }

  return "This would likely change the wallet in a noticeable but directional way.";
}

function simulateDefinition(
  portfolio: Portfolio,
  definition: InternalScenarioDefinition,
  selectedGoal?: PortfolioGoal,
  perps?: PerpsApiResponse | null
): PortfolioScenarioResult {
  const goal = chooseGoal(selectedGoal);
  const beforeRisk = buildUnifiedRiskSummary(portfolio, perps);
  const beforeStress = buildPortfolioStressSummary(portfolio, perps);
  const beforeGoalFit = buildPortfolioGoalFitSummary(portfolio, goal, perps);

  let afterPortfolio = portfolio;
  let afterPerps = clonePerps(perps);
  let assumptions: string[] = [];

  switch (definition.kind) {
    case "close_leverage": {
      const result = applyCloseLeverage(portfolio, perps);
      afterPortfolio = result.portfolio;
      afterPerps = result.perps;
      assumptions = result.assumptions;
      break;
    }
    case "increase_stables": {
      const result = applyStableShift(portfolio, definition.share);
      afterPortfolio = result.portfolio;
      assumptions = result.assumptions;
      break;
    }
    case "asset_drop": {
      const result = applyAssetShock(portfolio, perps, definition.symbols, definition.shockPct);
      afterPortfolio = result.portfolio;
      afterPerps = result.perps;
      assumptions = result.assumptions;
      break;
    }
    case "exit_protocol": {
      const result = applyExitProtocol(portfolio, definition.protocolId);
      afterPortfolio = result.portfolio;
      assumptions = result.assumptions;
      break;
    }
    case "unlock_liquidity": {
      const result = applyUnlockLiquidity(portfolio, definition.share);
      afterPortfolio = result.portfolio;
      assumptions = result.assumptions;
      break;
    }
  }

  const afterRisk = buildUnifiedRiskSummary(afterPortfolio, afterPerps);
  const afterStress = buildPortfolioStressSummary(afterPortfolio, afterPerps);
  const afterGoalFit = buildPortfolioGoalFitSummary(afterPortfolio, goal, afterPerps);
  const { deltaUsd, deltaPct } = estimateValueDelta(portfolio, afterPortfolio);

  return {
    scenarioId: definition.id,
    type: definition.type,
    title: definition.title,
    description: definition.description,
    priority: definition.priority,
    reasonGenerated: definition.reasonGenerated,
    estimatedValueDeltaUsd: deltaUsd,
    estimatedValueDeltaPct: deltaPct,
    bucketDeltas: buildBucketDeltas(portfolio, afterPortfolio),
    riskDelta: summarizeRiskDelta(beforeRisk, afterRisk),
    goalFitDelta: summarizeGoalFitDelta(beforeGoalFit, afterGoalFit),
    liquidityDelta: summarizeLiquidityDelta(beforeStress, afterStress),
    takeaway: buildTakeaway(definition, portfolio, afterRisk, beforeStress, afterStress),
    assumptions,
  };
}

export function getScenarioDefinitions(
  portfolio: Portfolio,
  selectedGoal?: PortfolioGoal,
  perps?: PerpsApiResponse | null
): PortfolioScenarioDefinition[] {
  return buildAdaptiveScenarioDefinitions(portfolio, selectedGoal, perps).map((scenario) => ({
    id: scenario.id,
    type: scenario.type,
    title: scenario.title,
    description: scenario.description,
    priority: scenario.priority,
    reasonGenerated: scenario.reasonGenerated,
  }));
}

export function buildScenarioSimulation(
  portfolio: Portfolio,
  scenarioId: string,
  selectedGoal: PortfolioGoal = DEFAULT_SCENARIO_GOAL,
  perps?: PerpsApiResponse | null
): PortfolioScenarioResult {
  const definition = buildAdaptiveScenarioDefinitions(portfolio, selectedGoal, perps).find((scenario) => scenario.id === scenarioId)
    ?? buildAdaptiveScenarioDefinitions(portfolio, selectedGoal, perps)[0];

  return simulateDefinition(portfolio, definition, selectedGoal, perps);
}

export function buildAdaptiveScenarioResults(
  portfolio: Portfolio,
  selectedGoal: PortfolioGoal = DEFAULT_SCENARIO_GOAL,
  perps?: PerpsApiResponse | null
): PortfolioScenarioResult[] {
  return buildAdaptiveScenarioDefinitions(portfolio, selectedGoal, perps)
    .map((scenario) => simulateDefinition(portfolio, scenario, selectedGoal, perps))
    .sort((a, b) => b.priority - a.priority);
}
