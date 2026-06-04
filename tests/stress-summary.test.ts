import test from "node:test";
import assert from "node:assert/strict";
import { buildPortfolioStressSummary } from "../lib/stressSummary.ts";
import type {
  AggregatedHolding,
  NormalizedPosition,
  PerpsApiResponse,
  Portfolio,
  PortfolioSummary,
  ProtocolPosition,
} from "../types/index.ts";

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

function makeAggregatedHolding(overrides: Partial<AggregatedHolding> = {}): AggregatedHolding {
  return {
    aggregateKey: overrides.aggregateKey ?? "eth",
    symbol: overrides.symbol ?? "ETH",
    name: overrides.name ?? "Ether",
    logo: overrides.logo,
    fungibleId: overrides.fungibleId,
    coingeckoId: overrides.coingeckoId,
    price: overrides.price ?? 1,
    priceChange24h: overrides.priceChange24h,
    priceAvailable: overrides.priceAvailable ?? true,
    totalBalance: overrides.totalBalance ?? 1,
    totalUsdValue: overrides.totalUsdValue ?? 100,
    walletBalance: overrides.walletBalance ?? 1,
    walletUsdValue: overrides.walletUsdValue ?? overrides.totalUsdValue ?? 100,
    defiBalance: overrides.defiBalance ?? 0,
    defiUsdValue: overrides.defiUsdValue ?? 0,
    isNative: overrides.isNative ?? false,
    isStablecoin: overrides.isStablecoin ?? false,
    positions: overrides.positions ?? [],
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
  walletPositions?: NormalizedPosition[];
  defiPositions?: NormalizedPosition[];
  liabilities?: NormalizedPosition[];
  aggregated?: AggregatedHolding[];
  protocols?: ProtocolPosition[];
  chainAllocations?: Portfolio["chainAllocations"];
  protocolAllocations?: Portfolio["protocolAllocations"];
  totalUsdValue?: number;
  totalBorrowUsdValue?: number;
} = {}): Portfolio {
  const walletPositions = opts.walletPositions ?? [];
  const defiPositions = opts.defiPositions ?? [];
  const liabilities = opts.liabilities ?? [];
  const totalUsdValue = opts.totalUsdValue ?? [...walletPositions, ...defiPositions].reduce((sum, p) => sum + (p.usdValue ?? 0), 0);
  return {
    address: "0xabc",
    walletPositions,
    defiPositions,
    liabilities,
    protocols: opts.protocols ?? [],
    aggregated: opts.aggregated ?? [],
    chainAllocations: opts.chainAllocations ?? [],
    protocolAllocations: opts.protocolAllocations ?? [],
    summary: makeSummary(totalUsdValue, opts.totalBorrowUsdValue ?? 0),
    lastUpdated: new Date().toISOString(),
  };
}

function makePerps(leverage: number): PerpsApiResponse {
  return {
    platforms: [],
    allPositions: [{
      platform: "Hyperliquid",
      chain: "Hyperliquid",
      chainColor: "#00FF7F",
      market: "HYPE-PERP",
      coin: "HYPE",
      side: "long",
      size: 1,
      entryPrice: 100,
      markPrice: 100,
      positionValue: 1000 * leverage,
      unrealizedPnl: 0,
      leverage,
      leverageType: "cross",
      liquidationPrice: null,
      liqDistancePct: null,
      marginUsed: 1000,
      fundingSinceOpen: 0,
      returnOnEquity: 0,
      riskLevel: leverage >= 5 ? "critical" : "warning",
      status: "open",
      isExact: true,
    }],
    totalUnrealizedPnl: 0,
    totalRealizedPnl: 0,
    totalFunding: 0,
    totalFees: 0,
    netLifetimePnl: 0,
    totalAccountValue: 1000,
    openPositionCount: 1,
    hasAnyPositions: true,
    isPartialData: false,
  };
}

test("High leverage portfolio makes leverage the biggest danger", () => {
  const portfolio = makePortfolio({
    walletPositions: [makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 1000, isStablecoin: true })],
    aggregated: [makeAggregatedHolding({ symbol: "USDC", name: "USD Coin", totalUsdValue: 1000, isStablecoin: true })],
    totalUsdValue: 1000,
  });

  const summary = buildPortfolioStressSummary(portfolio, makePerps(6));
  assert.equal(summary.overallState, "Critical");
  assert.equal(summary.biggestDanger.type, "leverage");
  assert.match(summary.biggestDanger.explanation, /leverage/i);
});

test("High protocol concentration appears as a protocol danger", () => {
  const deposit = makePosition({ id: "dep", source: "defi", positionType: "deposit", symbol: "ETH", name: "Ether", usdValue: 900, protocolId: "morpho", protocolName: "Morpho" });
  const protocol: ProtocolPosition = {
    id: "morpho",
    protocolId: "morpho",
    protocolName: "Morpho",
    dataSource: "zerion",
    chainSlug: "ethereum",
    chainName: "Ethereum",
    chainColor: "#627EEA",
    chainEmoji: "⬡",
    category: "lending",
    deposits: [deposit],
    borrows: [],
    rewards: [],
    staked: [],
    locked: [],
    totalDepositUsd: 900,
    totalBorrowUsd: 0,
    totalRewardUsd: 0,
    totalStakedUsd: 0,
    netUsdValue: 900,
  };

  const portfolio = makePortfolio({
    defiPositions: [deposit],
    aggregated: [makeAggregatedHolding({ symbol: "ETH", totalUsdValue: 900, positions: [deposit] })],
    protocols: [protocol],
    walletPositions: [makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 100, isStablecoin: true })],
    protocolAllocations: [{
      protocolId: "morpho",
      protocolName: "Morpho",
      netUsdValue: 900,
      percentage: 90,
      category: "lending",
      chainSlug: "ethereum",
      chainName: "Ethereum",
      chainColor: "#627EEA",
    }],
    totalUsdValue: 1000,
  });

  const summary = buildPortfolioStressSummary(portfolio, null);
  assert.equal(summary.biggestDanger.type, "protocol");
  assert.match(summary.biggestDanger.explanation, /Morpho/i);
});

test("Strong stablecoin buffer appears in liquid access", () => {
  const usdc = makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 700, isStablecoin: true });
  const eth = makePosition({ symbol: "ETH", name: "Ether", usdValue: 300 });
  const portfolio = makePortfolio({
    walletPositions: [usdc, eth],
    aggregated: [
      makeAggregatedHolding({ symbol: "USDC", name: "USD Coin", totalUsdValue: 700, isStablecoin: true, positions: [usdc] }),
      makeAggregatedHolding({ symbol: "ETH", name: "Ether", totalUsdValue: 300, positions: [eth] }),
    ],
    totalUsdValue: 1000,
  });

  const summary = buildPortfolioStressSummary(portfolio, null);
  assert.ok(summary.liquidAccess.topItems.some((item) => /USDC/i.test(item.label)));
  assert.ok(summary.defensiveCash.topItems.some((item) => /USDC/i.test(item.label)));
  assert.ok(summary.liquidAccess.topItems.some((item) => /defensive cash/i.test(item.reason)));
});

test("Locked positions appear in limited access", () => {
  const locked = makePosition({ source: "defi", positionType: "locked", symbol: "SEED", name: "Seedify Locked", usdValue: 400, protocolName: "Seedify" });
  const portfolio = makePortfolio({
    defiPositions: [locked],
    aggregated: [makeAggregatedHolding({ symbol: "SEED", name: "Seedify", totalUsdValue: 400, positions: [locked] })],
    totalUsdValue: 400,
  });

  const summary = buildPortfolioStressSummary(portfolio, null);
  assert.ok(summary.limitedAccess.topItems.some((item) => item.exitDifficulty === "Locked"));
});

test("DeFi positions with non-instant exit do not appear as fully liquid", () => {
  const deposit = makePosition({ source: "defi", positionType: "deposit", symbol: "ETH", name: "Ether", usdValue: 500, protocolName: "Morpho" });
  const portfolio = makePortfolio({
    defiPositions: [deposit],
    aggregated: [makeAggregatedHolding({ symbol: "ETH", totalUsdValue: 500, positions: [deposit] })],
    totalUsdValue: 500,
  });

  const summary = buildPortfolioStressSummary(portfolio, null);
  assert.equal(summary.liquidAccess.topItems.some((item) => /Morpho/i.test(item.label)), false);
  assert.ok(summary.limitedAccess.topItems.some((item) => /Morpho/i.test(item.label)));
});

test("Quickly sellable wallet assets are not described like defensive cash", () => {
  const eth = makePosition({ symbol: "ETH", name: "Ether", usdValue: 500 });
  const portfolio = makePortfolio({
    walletPositions: [eth],
    aggregated: [makeAggregatedHolding({ symbol: "ETH", totalUsdValue: 500, positions: [eth] })],
    totalUsdValue: 500,
  });

  const summary = buildPortfolioStressSummary(portfolio, null);
  assert.ok(summary.quickToSell.topItems.some((item) => /volatile/i.test(item.reason)));
  assert.equal(summary.defensiveCash.topItems.length, 0);
});

test("Urgent actions reflect actual stress conditions", () => {
  const portfolio = makePortfolio({
    walletPositions: [makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 200, isStablecoin: true })],
    aggregated: [makeAggregatedHolding({ symbol: "USDC", name: "USD Coin", totalUsdValue: 200, isStablecoin: true })],
    totalUsdValue: 200,
  });

  const summary = buildPortfolioStressSummary(portfolio, makePerps(6));
  assert.ok(summary.urgentActions.some((action) => /leveraged positions/i.test(action.text)));
});

test("Safe portfolio gets a calm headline and no alarmist actions", () => {
  const usdc = makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 300, isStablecoin: true });
  const eth = makePosition({ symbol: "ETH", name: "Ether", usdValue: 350 });
  const btc = makePosition({ symbol: "BTC", name: "Bitcoin", usdValue: 350 });
  const portfolio = makePortfolio({
    walletPositions: [usdc, eth, btc],
    aggregated: [
      makeAggregatedHolding({ symbol: "ETH", name: "Ether", totalUsdValue: 350, positions: [eth] }),
      makeAggregatedHolding({ symbol: "BTC", name: "Bitcoin", totalUsdValue: 350, positions: [btc] }),
      makeAggregatedHolding({ symbol: "USDC", name: "USD Coin", totalUsdValue: 300, isStablecoin: true, positions: [usdc] }),
    ],
    totalUsdValue: 1000,
  });

  const summary = buildPortfolioStressSummary(portfolio, null);
  assert.equal(summary.overallState, "Safe");
  assert.match(summary.headline, /Safe/i);
  assert.ok(summary.urgentActions.every((action) => !/panic|sell/i.test(action.text)));
});

test("Stress summary uses the canonical unified risk truth state", () => {
  const eth = makePosition({ symbol: "ETH", name: "Ether", usdValue: 650 });
  const usdc = makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 350, isStablecoin: true });
  const portfolio = makePortfolio({
    walletPositions: [eth, usdc],
    aggregated: [
      makeAggregatedHolding({ symbol: "ETH", totalUsdValue: 650, positions: [eth] }),
      makeAggregatedHolding({ symbol: "USDC", name: "USD Coin", totalUsdValue: 350, isStablecoin: true, positions: [usdc] }),
    ],
    totalUsdValue: 1000,
  });

  const summary = buildPortfolioStressSummary(portfolio, null);
  assert.equal(summary.overallState, "Risky");
});

test("Canonical ranked risk signal drives stress biggest danger", () => {
  const portfolio = makePortfolio({
    walletPositions: [makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 1000, isStablecoin: true })],
    aggregated: [makeAggregatedHolding({ symbol: "USDC", name: "USD Coin", totalUsdValue: 1000, isStablecoin: true })],
    totalUsdValue: 1000,
  });

  const summary = buildPortfolioStressSummary(portfolio, makePerps(6));
  assert.equal(summary.biggestDanger.type, "leverage");
});

test("Stress View separates defensive cash from quick-to-sell volatile assets", () => {
  const usdc = makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 400, isStablecoin: true });
  const eth = makePosition({ symbol: "ETH", name: "Ether", usdValue: 600 });
  const portfolio = makePortfolio({
    walletPositions: [usdc, eth],
    aggregated: [
      makeAggregatedHolding({ symbol: "ETH", totalUsdValue: 600, positions: [eth] }),
      makeAggregatedHolding({ symbol: "USDC", name: "USD Coin", totalUsdValue: 400, isStablecoin: true, positions: [usdc] }),
    ],
    totalUsdValue: 1000,
  });
  const summary = buildPortfolioStressSummary(portfolio, null);
  assert.ok(summary.defensiveCash.topItems.some((item) => /USDC/i.test(item.label)));
  assert.ok(summary.quickToSell.topItems.some((item) => /ETH/i.test(item.label)));
});

test("Stress view does not double-count liquidity and limited access", () => {
  const usdc = makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 400, isStablecoin: true });
  const deposit = makePosition({ source: "defi", positionType: "deposit", symbol: "ETH", name: "Ether", usdValue: 300, protocolName: "Morpho" });
  const locked = makePosition({ source: "defi", positionType: "locked", symbol: "SEED", name: "Seedify Locked", usdValue: 200, protocolName: "Seedify" });
  const portfolio = makePortfolio({
    walletPositions: [usdc],
    defiPositions: [deposit, locked],
    aggregated: [
      makeAggregatedHolding({ symbol: "USDC", name: "USD Coin", totalUsdValue: 400, isStablecoin: true, positions: [usdc] }),
      makeAggregatedHolding({ symbol: "ETH", totalUsdValue: 300, positions: [deposit] }),
      makeAggregatedHolding({ symbol: "SEED", totalUsdValue: 200, positions: [locked] }),
    ],
    totalUsdValue: 900,
  });

  const summary = buildPortfolioStressSummary(portfolio, null);
  const liquidLabels = new Set(summary.liquidAccess.topItems.map((item) => item.label));
  const limitedLabels = new Set(summary.limitedAccess.topItems.map((item) => item.label));
  const overlap = [...liquidLabels].filter((label) => limitedLabels.has(label));
  assert.equal(overlap.length, 0);
});

test("Incomplete metadata still produces a safe fallback summary", () => {
  const portfolio = makePortfolio({
    walletPositions: [makePosition({ symbol: "TKN", name: "Unknown Token", usdValue: 40 })],
    aggregated: [],
    totalUsdValue: 40,
  });

  const summary = buildPortfolioStressSummary(portfolio, null);
  assert.ok(summary.headline.length > 0);
  assert.ok(summary.biggestDanger.explanation.length > 0);
});
