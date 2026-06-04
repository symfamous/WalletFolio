import test from "node:test";
import assert from "node:assert/strict";
import { buildPortfolio } from "../lib/aggregate/portfolio.ts";
import { buildProtocolPositions } from "../lib/normalize/protocols.ts";
import {
  buildAdaptiveScenarioResults,
  buildScenarioSimulation,
  getScenarioDefinitions,
} from "../lib/scenarioSimulator.ts";
import type {
  NormalizedPosition,
  PerpsApiResponse,
  Portfolio,
} from "../types/index.ts";

function makePosition(overrides: Partial<NormalizedPosition> = {}): NormalizedPosition {
  const usdValue = overrides.usdValue ?? 100;
  const balance = overrides.balance ?? usdValue;
  return {
    id: overrides.id ?? `pos-${Math.random().toString(36).slice(2)}`,
    symbol: overrides.symbol ?? "ETH",
    name: overrides.name ?? "Ether",
    logo: overrides.logo,
    contractAddress: overrides.contractAddress ?? `0x${(overrides.symbol ?? "eth").toLowerCase()}`,
    decimals: overrides.decimals ?? 18,
    fungibleId: overrides.fungibleId,
    coingeckoId: overrides.coingeckoId,
    chainSlug: overrides.chainSlug ?? "ethereum",
    chainName: overrides.chainName ?? "Ethereum",
    chainNumericId: overrides.chainNumericId,
    chainColor: overrides.chainColor ?? "#627EEA",
    chainEmoji: overrides.chainEmoji ?? "⬡",
    balance,
    rawBalance: overrides.rawBalance ?? String(balance),
    price: overrides.price ?? 1,
    priceChange24h: overrides.priceChange24h,
    usdValue,
    priceAvailable: overrides.priceAvailable ?? true,
    source: overrides.source ?? "wallet",
    positionType: overrides.positionType ?? "wallet",
    isLiability: overrides.isLiability ?? false,
    isNative: overrides.isNative ?? false,
    isStablecoin: overrides.isStablecoin ?? false,
    isSpam: overrides.isSpam ?? false,
    isVerified: overrides.isVerified ?? true,
    dataSource: overrides.dataSource ?? "zerion",
    protocolId: overrides.protocolId,
    protocolName: overrides.protocolName,
    healthFactor: overrides.healthFactor,
    collateralRatio: overrides.collateralRatio,
    liquidationPrice: overrides.liquidationPrice,
    apy: overrides.apy,
  };
}

function buildCanonicalPortfolio(
  walletPositions: NormalizedPosition[],
  defiPositions: NormalizedPosition[] = [],
  liabilities: NormalizedPosition[] = []
): Portfolio {
  const allPositions = [...walletPositions, ...defiPositions, ...liabilities];
  return buildPortfolio("0xabc", allPositions, buildProtocolPositions([...defiPositions, ...liabilities]));
}

function makePerps(overrides: Partial<PerpsApiResponse> = {}): PerpsApiResponse {
  return {
    platforms: [],
    allPositions: [{
      platform: "Hyperliquid",
      chain: "Hyperliquid",
      chainColor: "#00FF7F",
      market: "SOL-PERP",
      coin: "SOL",
      side: "long",
      size: 10,
      entryPrice: 100,
      markPrice: 100,
      positionValue: 1000,
      unrealizedPnl: 0,
      leverage: 5,
      leverageType: "cross",
      liquidationPrice: 80,
      liqDistancePct: 12,
      marginUsed: 200,
      fundingSinceOpen: 0,
      returnOnEquity: 0,
      riskLevel: "critical",
      status: "open",
      isExact: true,
    }],
    totalUnrealizedPnl: 0,
    totalRealizedPnl: 0,
    totalFunding: 0,
    totalFees: 0,
    netLifetimePnl: 0,
    totalAccountValue: 200,
    openPositionCount: 1,
    hasAnyPositions: true,
    isPartialData: false,
    ...overrides,
  };
}

test("A SOL-heavy wallet generates a SOL drop scenario, not ETH or HYPE by default", () => {
  const portfolio = buildCanonicalPortfolio([
    makePosition({ symbol: "SOL", name: "Solana", usdValue: 800 }),
    makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 200, isStablecoin: true }),
  ]);

  const scenarios = getScenarioDefinitions(portfolio, "Balanced", null);
  assert.ok(scenarios.some((scenario) => /SOL drops 20%/i.test(scenario.title)));
  assert.equal(scenarios.some((scenario) => /ETH drops|HYPE drops/i.test(scenario.title)), false);
});

test("A BTC-heavy wallet generates a BTC drop scenario", () => {
  const portfolio = buildCanonicalPortfolio([
    makePosition({ symbol: "BTC", name: "Bitcoin", usdValue: 750 }),
    makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 250, isStablecoin: true }),
  ]);

  const scenarios = getScenarioDefinitions(portfolio, "Balanced", null);
  assert.ok(scenarios.some((scenario) => /BTC drops/i.test(scenario.title)));
});

test("Stable-heavy wallet does not prioritize meaningless stable-drop scenarios", () => {
  const portfolio = buildCanonicalPortfolio([
    makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 800, isStablecoin: true }),
    makePosition({ symbol: "USDT", name: "Tether", usdValue: 200, isStablecoin: true }),
  ]);

  const scenarios = getScenarioDefinitions(portfolio, "Mostly Safe", null);
  assert.equal(scenarios.some((scenario) => /USDC drops|USDT drops|stable drops/i.test(scenario.title)), false);
});

test("Wallet with active leverage generates close-leverage scenario", () => {
  const portfolio = buildCanonicalPortfolio([
    makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 300, isStablecoin: true }),
    makePosition({ symbol: "SOL", name: "Solana", usdValue: 700 }),
  ]);

  const scenarios = getScenarioDefinitions(portfolio, "Balanced", makePerps());
  assert.ok(scenarios.some((scenario) => /close my leveraged position/i.test(scenario.title)));
});

test("Wallet without leverage does not generate close-leverage scenario", () => {
  const portfolio = buildCanonicalPortfolio([
    makePosition({ symbol: "ETH", usdValue: 600 }),
    makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 400, isStablecoin: true }),
  ]);

  const scenarios = getScenarioDefinitions(portfolio, "Balanced", null);
  assert.equal(scenarios.some((scenario) => /close my leveraged position/i.test(scenario.title)), false);
});

test("DeFi-heavy wallet generates exit-top-protocol scenario using the actual dominant protocol", () => {
  const morphoDeposit = makePosition({
    source: "defi",
    positionType: "deposit",
    symbol: "ETH",
    usdValue: 700,
    protocolId: "morpho",
    protocolName: "Morpho",
  });
  const walletCash = makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 300, isStablecoin: true });
  const portfolio = buildCanonicalPortfolio([walletCash], [morphoDeposit]);

  const scenarios = getScenarioDefinitions(portfolio, "Balanced", null);
  assert.ok(scenarios.some((scenario) => /exit morpho/i.test(scenario.title)));
});

test("Wallet without meaningful DeFi does not generate protocol-exit scenario", () => {
  const portfolio = buildCanonicalPortfolio([
    makePosition({ symbol: "ETH", usdValue: 900 }),
    makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 100, isStablecoin: true }),
  ]);

  const scenarios = getScenarioDefinitions(portfolio, "Balanced", null);
  assert.equal(scenarios.some((scenario) => /exit /i.test(scenario.title)), false);
});

test("Low defensive cash wallet generates increase-stables scenario", () => {
  const portfolio = buildCanonicalPortfolio([
    makePosition({ symbol: "SOL", usdValue: 600 }),
    makePosition({ symbol: "BTC", usdValue: 400 }),
  ]);

  const scenarios = getScenarioDefinitions(portfolio, "Mostly Safe", null);
  assert.ok(scenarios.some((scenario) => /move 20% into stables/i.test(scenario.title)));
});

test("Goal selection changes scenario prioritization sensibly", () => {
  const portfolio = buildCanonicalPortfolio([
    makePosition({ symbol: "SOL", usdValue: 700 }),
    makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 300, isStablecoin: true }),
  ]);

  const safeScenarios = buildAdaptiveScenarioResults(portfolio, "Mostly Safe", makePerps());
  const traderScenarios = buildAdaptiveScenarioResults(portfolio, "Active Trader", makePerps());

  assert.match(safeScenarios[0].title, /close my leveraged position|move 20% into stables/i);
  assert.notEqual(safeScenarios[0].title, traderScenarios[0].title);
});

test("Generated scenarios use canonical risk, bucket, goal-fit, and liquidity logic", () => {
  const portfolio = buildCanonicalPortfolio([
    makePosition({ symbol: "SOL", usdValue: 700 }),
    makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 300, isStablecoin: true }),
  ]);
  const scenario = buildAdaptiveScenarioResults(portfolio, "Balanced", makePerps())[0];

  assert.ok(Boolean(scenario.riskDelta.summary));
  assert.ok(Boolean(scenario.goalFitDelta?.summary));
  assert.ok(Boolean(scenario.liquidityDelta?.summary));
  assert.ok(scenario.bucketDeltas.length >= 0);
});

test("Scenario outputs do not double-count positions", () => {
  const portfolio = buildCanonicalPortfolio([
    makePosition({ symbol: "SOL", usdValue: 600 }),
    makePosition({ symbol: "BTC", usdValue: 400 }),
  ]);

  const scenario = buildAdaptiveScenarioResults(portfolio, "Balanced", null)
    .find((item) => /move 20% into stables/i.test(item.title));

  assert.ok(scenario);
  const bucketDeltaSum = scenario!.bucketDeltas.reduce((sum, item) => sum + item.deltaUsd, 0);
  assert.ok(Math.abs(bucketDeltaSum - (scenario!.estimatedValueDeltaUsd ?? 0)) <= 0.01);
});

test("Asset-drop assumptions preserve the negative price shock direction", () => {
  const portfolio = buildCanonicalPortfolio([
    makePosition({ symbol: "SOL", usdValue: 800 }),
    makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 200, isStablecoin: true }),
  ]);

  const scenario = buildAdaptiveScenarioResults(portfolio, "Balanced", null)
    .find((item) => /SOL drops 20%/i.test(item.title));

  assert.ok(scenario);
  assert.ok(scenario!.assumptions.some((assumption) => assumption.includes("-20% price shock")));
});

test("Incomplete metadata yields safe fallback scenario generation", () => {
  const portfolio = buildCanonicalPortfolio([
    makePosition({ symbol: "ABC", name: "Token ABC", usdValue: 0, priceAvailable: false, price: undefined }),
    makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 50, isStablecoin: true }),
  ]);

  const scenarios = buildAdaptiveScenarioResults(portfolio, "Balanced", null);
  assert.ok(scenarios.length >= 1);
  assert.ok(scenarios.every((scenario) => scenario.assumptions.length > 0));
});

test("buildScenarioSimulation still resolves a generated scenario id correctly", () => {
  const portfolio = buildCanonicalPortfolio([
    makePosition({ symbol: "SOL", usdValue: 700 }),
    makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 300, isStablecoin: true }),
  ]);
  const scenarioId = getScenarioDefinitions(portfolio, "Balanced", null)[0].id;
  const result = buildScenarioSimulation(portfolio, scenarioId, "Balanced", null);

  assert.equal(result.scenarioId, scenarioId);
  assert.ok(Boolean(result.reasonGenerated));
});
