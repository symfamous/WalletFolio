import test from "node:test";
import assert from "node:assert/strict";
import {
  buildUnifiedRiskSummary,
  getAlertStatusCopy,
  getLegacyRiskLevel,
  getRiskSummaryLine,
} from "../lib/riskTruth.ts";
import { getRiskStatePresentation } from "../lib/riskMonitor.ts";
import type { NormalizedPosition, PerpsApiResponse, Portfolio, PortfolioSummary, ProtocolPosition } from "../types/index.ts";

function makePosition(overrides: Partial<NormalizedPosition> = {}): NormalizedPosition {
  const usdValue = overrides.usdValue ?? 100;
  return {
    id: overrides.id ?? `pos-${Math.random().toString(36).slice(2)}`,
    symbol: overrides.symbol ?? "ETH",
    name: overrides.name ?? "Ether",
    logo: overrides.logo,
    contractAddress: overrides.contractAddress ?? "0xeth",
    decimals: overrides.decimals ?? 18,
    fungibleId: overrides.fungibleId,
    coingeckoId: overrides.coingeckoId,
    chainSlug: overrides.chainSlug ?? "ethereum",
    chainName: overrides.chainName ?? "Ethereum",
    chainNumericId: overrides.chainNumericId,
    chainColor: overrides.chainColor ?? "#627EEA",
    chainEmoji: overrides.chainEmoji ?? "⬡",
    balance: overrides.balance ?? usdValue,
    rawBalance: overrides.rawBalance ?? String(usdValue),
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

function makeSummary(totalUsdValue: number, totalBorrowUsdValue = 0): PortfolioSummary {
  return {
    totalUsdValue,
    walletUsdValue: totalUsdValue,
    defiNetUsdValue: 0,
    totalBorrowUsdValue,
    activeChainCount: 1,
    activeProtocolCount: 1,
    pricedAssetCount: 1,
    totalAssetCount: 1,
  };
}

function makePortfolio(opts: {
  aggregated?: Portfolio["aggregated"];
  chainAllocations?: Portfolio["chainAllocations"];
  protocolAllocations?: Portfolio["protocolAllocations"];
  protocols?: ProtocolPosition[];
  totalUsdValue?: number;
  totalBorrowUsdValue?: number;
} = {}): Portfolio {
  const totalUsdValue = opts.totalUsdValue ?? 1000;
  return {
    address: "0xabc",
    walletPositions: [],
    defiPositions: [],
    liabilities: [],
    protocols: opts.protocols ?? [],
    aggregated: opts.aggregated ?? [],
    chainAllocations: opts.chainAllocations ?? [],
    protocolAllocations: opts.protocolAllocations ?? [],
    summary: makeSummary(totalUsdValue, opts.totalBorrowUsdValue ?? 0),
    lastUpdated: new Date().toISOString(),
  };
}

function makePerps(impliedLeverage: number): PerpsApiResponse {
  const totalAccountValue = 1000;
  return {
    platforms: [],
    allPositions: [
      {
        platform: "Hyperliquid",
        chain: "Hyperliquid",
        chainColor: "#00FF7F",
        market: "BTC-PERP",
        coin: "BTC",
        side: "long",
        size: 1,
        entryPrice: 100,
        markPrice: 100,
        positionValue: totalAccountValue * impliedLeverage,
        unrealizedPnl: 0,
        leverage: impliedLeverage,
        leverageType: "cross",
        liquidationPrice: null,
        liqDistancePct: null,
        marginUsed: totalAccountValue,
        fundingSinceOpen: 0,
        returnOnEquity: 0,
        riskLevel: impliedLeverage > 5 ? "critical" : impliedLeverage > 3 ? "warning" : "safe",
        status: "open",
        isExact: true,
      },
    ],
    totalUnrealizedPnl: 0,
    totalRealizedPnl: 0,
    totalFunding: 0,
    totalFees: 0,
    netLifetimePnl: 0,
    totalAccountValue,
    openPositionCount: 1,
    hasAnyPositions: true,
    isPartialData: false,
  };
}

test("Any Critical factor makes overall state Critical", () => {
  const portfolio = makePortfolio();
  const risk = buildUnifiedRiskSummary(portfolio, makePerps(6));
  assert.equal(risk.overallState, "Critical");
});

test("Any Risky factor with no Critical makes overall state Risky", () => {
  const portfolio = makePortfolio({
    aggregated: [{ aggregateKey: "eth", symbol: "ETH", name: "Ether", priceAvailable: true, totalBalance: 1, totalUsdValue: 650, walletBalance: 1, walletUsdValue: 650, defiBalance: 0, defiUsdValue: 0, isNative: false, isStablecoin: false, positions: [] }],
    totalUsdValue: 1000,
  });
  const risk = buildUnifiedRiskSummary(portfolio);
  assert.equal(risk.overallState, "Risky");
});

test("Any Watch factor with no Risky or Critical makes overall state Watch", () => {
  const portfolio = makePortfolio({
    aggregated: [{ aggregateKey: "usdc", symbol: "USDC", name: "USD Coin", priceAvailable: true, totalBalance: 1, totalUsdValue: 40, walletBalance: 1, walletUsdValue: 40, defiBalance: 0, defiUsdValue: 0, isNative: false, isStablecoin: true, positions: [] }],
    totalUsdValue: 1000,
  });
  const risk = buildUnifiedRiskSummary(portfolio);
  assert.equal(risk.overallState, "Watch");
});

test("No triggered risk factors yields Safe", () => {
  const portfolio = makePortfolio({
    aggregated: [{ aggregateKey: "usdc", symbol: "USDC", name: "USD Coin", priceAvailable: true, totalBalance: 1, totalUsdValue: 150, walletBalance: 1, walletUsdValue: 150, defiBalance: 0, defiUsdValue: 0, isNative: false, isStablecoin: true, positions: [] }],
    totalUsdValue: 1000,
  });
  const risk = buildUnifiedRiskSummary(portfolio);
  assert.equal(risk.overallState, "Safe");
  assert.equal(risk.triggeredFactors.length, 0);
});

test("Portfolio Intelligence and Risk Monitor derive labels from the same canonical overall state", () => {
  const risk = buildUnifiedRiskSummary(makePortfolio(), makePerps(6));
  assert.equal(getRiskStatePresentation(risk.overallState).label, "Critical");
  assert.ok(getRiskSummaryLine(risk).startsWith("Critical"));
});

test("Critical leverage cannot coexist with all-clear summary copy", () => {
  const risk = buildUnifiedRiskSummary(makePortfolio(), makePerps(6));
  assert.equal(risk.overallState, "Critical");
  assert.equal(risk.summaryCopy.includes("No major risks"), false);
  assert.equal(getAlertStatusCopy(risk, 0).includes("All clear"), false);
});

test("Active leverage stays active even when it is modest", () => {
  const risk = buildUnifiedRiskSummary(makePortfolio(), makePerps(1.5));
  assert.equal(risk.leverage.isActive, true);
  assert.equal(risk.leverage.openPositions, 1);
  const perpFactor = [...risk.triggeredFactors, ...risk.safeFactors].find((factor) => factor.id === "perp_leverage");
  assert.ok(perpFactor);
  assert.notEqual(perpFactor?.displayValue, "No active perp leverage");
  assert.match(perpFactor?.displayValue ?? "", /open/i);
});

test("No leverage active downgrades consistently across the canonical signal", () => {
  const risk = buildUnifiedRiskSummary(makePortfolio(), null);
  assert.equal(risk.leverage.isActive, false);
  assert.equal(risk.leverage.severity, "None");
  const perpFactor = [...risk.triggeredFactors, ...risk.safeFactors].find((factor) => factor.id === "perp_leverage");
  assert.equal(perpFactor?.displayValue, "No active perp leverage");
});

test("Active leverage can exist without liquidation pressure", () => {
  const risk = buildUnifiedRiskSummary(makePortfolio(), makePerps(4));
  assert.equal(risk.leverage.isActive, true);
  assert.equal(risk.leverage.hasLiquidationPressure, false);
  assert.equal(risk.leverage.liquidationExplanation, "No immediate liquidation pressure detected.");
  const liqFactor = risk.rankedFactors.find((factor) => factor.id === "perp_liquidation_pressure");
  assert.equal(liqFactor?.displayValue, "No immediate liquidation pressure");
});

test("Factor explanations and topReason remain populated for non-Safe states", () => {
  const risk = buildUnifiedRiskSummary(makePortfolio(), makePerps(4));
  assert.equal(risk.overallState, "Risky");
  assert.ok(risk.topReason.length > 0);
  assert.ok(risk.triggeredFactors.every((factor) => factor.explanation.length > 0));
  assert.equal(risk.topRiskId, "perp_leverage");
});

test("Existing factor calculations still work after refactor", () => {
  const protocol: ProtocolPosition = {
    id: "aave-eth",
    protocolId: "aave",
    protocolName: "Aave",
    dataSource: "zerion",
    chainSlug: "ethereum",
    chainName: "Ethereum",
    chainColor: "#627EEA",
    chainEmoji: "⬡",
    category: "lending",
    deposits: [makePosition({ id: "dep", source: "defi", positionType: "deposit", usdValue: 500 })],
    borrows: [makePosition({ id: "bor", source: "defi", positionType: "borrow", usdValue: 200, isLiability: true })],
    rewards: [],
    staked: [],
    locked: [],
    totalDepositUsd: 500,
    totalBorrowUsd: 200,
    totalRewardUsd: 0,
    totalStakedUsd: 0,
    netUsdValue: 300,
    healthFactor: 1.05,
  };

  const portfolio = makePortfolio({
    protocols: [protocol],
    protocolAllocations: [{
      protocolId: "aave",
      protocolName: "Aave",
      netUsdValue: 300,
      percentage: 90,
      category: "lending",
      chainSlug: "ethereum",
      chainName: "Ethereum",
      chainColor: "#627EEA",
    }],
    chainAllocations: [{
      chainSlug: "ethereum",
      chainName: "Ethereum",
      chainColor: "#627EEA",
      chainEmoji: "⬡",
      totalUsdValue: 900,
      percentage: 90,
      tokenCount: 3,
    }],
    totalUsdValue: 1000,
    totalBorrowUsdValue: 200,
  });

  const risk = buildUnifiedRiskSummary(portfolio);
  const ids = risk.triggeredFactors.map((factor) => factor.id);
  assert.ok(ids.includes("liquidation_risk"));
  assert.ok(ids.includes("protocol_concentration"));
  assert.ok(ids.includes("chain_concentration"));
});

test("Alerts wording follows the canonical overall risk state", () => {
  const safeRisk = buildUnifiedRiskSummary(makePortfolio({
    aggregated: [{ aggregateKey: "usdc", symbol: "USDC", name: "USD Coin", priceAvailable: true, totalBalance: 1, totalUsdValue: 150, walletBalance: 1, walletUsdValue: 150, defiBalance: 0, defiUsdValue: 0, isNative: false, isStablecoin: true, positions: [] }],
    totalUsdValue: 1000,
  }), null);
  const criticalRisk = buildUnifiedRiskSummary(makePortfolio(), makePerps(6));
  assert.equal(getAlertStatusCopy(safeRisk, 0), "No alert rules have fired.");
  assert.match(getAlertStatusCopy(criticalRisk, 0), /critical risk condition/i);
});

test("Legacy risk level mapping remains stable for PWA badges", () => {
  assert.equal(getLegacyRiskLevel("Safe"), "safe");
  assert.equal(getLegacyRiskLevel("Watch"), "moderate");
  assert.equal(getLegacyRiskLevel("Risky"), "risky");
  assert.equal(getLegacyRiskLevel("Critical"), "critical");
});

test("Alert copy for elevated states stays truthful and calm", () => {
  const watchRisk = buildUnifiedRiskSummary(makePortfolio({
    aggregated: [{ aggregateKey: "usdc", symbol: "USDC", name: "USD Coin", priceAvailable: true, totalBalance: 1, totalUsdValue: 40, walletBalance: 1, walletUsdValue: 40, defiBalance: 0, defiUsdValue: 0, isNative: false, isStablecoin: true, positions: [] }],
    totalUsdValue: 1000,
  }));
  assert.match(getAlertStatusCopy(watchRisk, 0), /need attention/i);

  const criticalRisk = buildUnifiedRiskSummary(makePortfolio(), makePerps(6));
  assert.match(getAlertStatusCopy(criticalRisk, 0), /critical risk condition/i);
});
