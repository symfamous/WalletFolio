import test from "node:test";
import assert from "node:assert/strict";
import { buildPortfolioGoalFitSummary } from "../lib/goalFit.ts";
import { DEFAULT_PORTFOLIO_GOAL, readGoalPreference, writeGoalPreference } from "../lib/goalPreference.ts";
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

function makeSummary(totalUsdValue: number, overrides: Partial<PortfolioSummary> = {}): PortfolioSummary {
  return {
    totalUsdValue,
    walletUsdValue: totalUsdValue,
    defiNetUsdValue: 0,
    totalBorrowUsdValue: 0,
    activeChainCount: 1,
    activeProtocolCount: 1,
    pricedAssetCount: 1,
    totalAssetCount: 1,
    ...overrides,
  };
}

function makePortfolio(opts: {
  walletPositions?: NormalizedPosition[];
  defiPositions?: NormalizedPosition[];
  aggregated?: AggregatedHolding[];
  protocols?: ProtocolPosition[];
  chainAllocations?: Portfolio["chainAllocations"];
  protocolAllocations?: Portfolio["protocolAllocations"];
  summaryOverrides?: Partial<PortfolioSummary>;
  totalUsdValue?: number;
} = {}): Portfolio {
  const walletPositions = opts.walletPositions ?? [];
  const defiPositions = opts.defiPositions ?? [];
  const totalUsdValue = opts.totalUsdValue ?? [...walletPositions, ...defiPositions].reduce((sum, p) => sum + (p.usdValue ?? 0), 0);

  return {
    address: "0xabc",
    walletPositions,
    defiPositions,
    liabilities: [],
    protocols: opts.protocols ?? [],
    aggregated: opts.aggregated ?? [],
    chainAllocations: opts.chainAllocations ?? [],
    protocolAllocations: opts.protocolAllocations ?? [],
    summary: makeSummary(totalUsdValue, opts.summaryOverrides),
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

test("High leverage portfolio is a poor fit for Mostly Safe", () => {
  const usdc = makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 1000, isStablecoin: true });
  const portfolio = makePortfolio({
    walletPositions: [usdc],
    aggregated: [makeAggregatedHolding({ symbol: "USDC", name: "USD Coin", totalUsdValue: 1000, isStablecoin: true, positions: [usdc] })],
    totalUsdValue: 1000,
  });

  const summary = buildPortfolioGoalFitSummary(portfolio, "Mostly Safe", makePerps(6));
  assert.equal(summary.overallFitState, "Poor Fit");
  assert.match(summary.topMismatch.explanation, /leverage/i);
  assert.equal(summary.topMismatch.label, "Leverage");
});

test("Strong stable and liquid portfolio fits Mostly Safe better", () => {
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

  const summary = buildPortfolioGoalFitSummary(portfolio, "Mostly Safe", null);
  assert.ok(summary.overallFitState === "Mostly Fits" || summary.overallFitState === "Strong Fit");
  assert.match(summary.topAlignedArea.explanation, /stable|liquid|defensive/i);
});

test("Large active trade share fits Active Trader better than Mostly Safe", () => {
  const active = makePosition({
    symbol: "HYPE",
    name: "Hyperliquid Perps",
    usdValue: 450,
    protocolId: "hyperliquid-perps",
    protocolName: "Hyperliquid",
  });
  const usdc = makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 550, isStablecoin: true });
  const portfolio = makePortfolio({
    walletPositions: [active, usdc],
    aggregated: [
      makeAggregatedHolding({ symbol: "HYPE", name: "Hyperliquid Perps", totalUsdValue: 450, positions: [active] }),
      makeAggregatedHolding({ symbol: "USDC", name: "USD Coin", totalUsdValue: 550, isStablecoin: true, positions: [usdc] }),
    ],
    totalUsdValue: 1000,
  });

  const trader = buildPortfolioGoalFitSummary(portfolio, "Active Trader", null);
  const safe = buildPortfolioGoalFitSummary(portfolio, "Mostly Safe", null);
  assert.ok((trader.fitScore ?? 0) > (safe.fitScore ?? 0));
});

test("High locked share is a mismatch for Active Trader", () => {
  const locked = makePosition({
    source: "defi",
    positionType: "locked",
    symbol: "SEED",
    name: "Seedify Locked",
    usdValue: 600,
    protocolName: "Seedify",
  });
  const usdc = makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 400, isStablecoin: true });
  const portfolio = makePortfolio({
    walletPositions: [usdc],
    defiPositions: [locked],
    aggregated: [
      makeAggregatedHolding({ symbol: "SEED", name: "Seedify", totalUsdValue: 600, positions: [locked] }),
      makeAggregatedHolding({ symbol: "USDC", name: "USD Coin", totalUsdValue: 400, isStablecoin: true, positions: [usdc] }),
    ],
    totalUsdValue: 1000,
  });

  const summary = buildPortfolioGoalFitSummary(portfolio, "Active Trader", null);
  assert.match(summary.topMismatch.explanation, /tied up|locked|slow/i);
});

test("High wallet complexity is a mismatch for Learn Slowly", () => {
  const dustA = makePosition({ symbol: "AAA", name: "Token AAA", usdValue: 5, chainSlug: "arbitrum", chainName: "Arbitrum" });
  const dustB = makePosition({ symbol: "BBB", name: "Token BBB", usdValue: 5, chainSlug: "base", chainName: "Base" });
  const dustC = makePosition({ symbol: "CCC", name: "Token CCC", usdValue: 5, chainSlug: "optimism", chainName: "Optimism" });
  const active = makePosition({ symbol: "HYPE", name: "Hyperliquid Perps", usdValue: 200, protocolId: "hyperliquid-perps", protocolName: "Hyperliquid" });
  const deposit = makePosition({ source: "defi", positionType: "deposit", symbol: "ETH", name: "Ether", usdValue: 300, protocolName: "Morpho" });
  const locked = makePosition({ source: "defi", positionType: "locked", symbol: "JTO", name: "Jito Locked", usdValue: 200, protocolName: "Jito" });
  const eth = makePosition({ symbol: "ETH", name: "Ether", usdValue: 285 });
  const portfolio = makePortfolio({
    walletPositions: [active, eth, dustA, dustB, dustC],
    defiPositions: [deposit, locked],
    aggregated: [
      makeAggregatedHolding({ symbol: "HYPE", totalUsdValue: 200, positions: [active] }),
      makeAggregatedHolding({ symbol: "ETH", totalUsdValue: 585, positions: [eth, deposit] }),
      makeAggregatedHolding({ symbol: "JTO", totalUsdValue: 200, positions: [locked] }),
      makeAggregatedHolding({ symbol: "AAA", totalUsdValue: 5, positions: [dustA] }),
      makeAggregatedHolding({ symbol: "BBB", totalUsdValue: 5, positions: [dustB] }),
      makeAggregatedHolding({ symbol: "CCC", totalUsdValue: 5, positions: [dustC] }),
    ],
    protocolAllocations: [
      { protocolId: "morpho", protocolName: "Morpho", netUsdValue: 300, percentage: 30, category: "lending", chainSlug: "ethereum", chainName: "Ethereum", chainColor: "#627EEA" },
      { protocolId: "jito", protocolName: "Jito", netUsdValue: 200, percentage: 20, category: "staking", chainSlug: "solana", chainName: "Solana", chainColor: "#9945FF" },
    ],
    chainAllocations: [
      { chainSlug: "ethereum", chainName: "Ethereum", chainColor: "#627EEA", chainEmoji: "⬡", totalUsdValue: 785, percentage: 78.5, tokenCount: 3 },
      { chainSlug: "arbitrum", chainName: "Arbitrum", chainColor: "#28A0F0", chainEmoji: "🔷", totalUsdValue: 5, percentage: 0.5, tokenCount: 1 },
      { chainSlug: "base", chainName: "Base", chainColor: "#0052FF", chainEmoji: "🔵", totalUsdValue: 5, percentage: 0.5, tokenCount: 1 },
      { chainSlug: "optimism", chainName: "Optimism", chainColor: "#FF0420", chainEmoji: "🔴", totalUsdValue: 5, percentage: 0.5, tokenCount: 1 },
      { chainSlug: "hyperliquid", chainName: "Hyperliquid", chainColor: "#00FF7F", chainEmoji: "🟢", totalUsdValue: 200, percentage: 20, tokenCount: 1 },
    ],
    summaryOverrides: {
      activeChainCount: 5,
      activeProtocolCount: 3,
      totalAssetCount: 7,
      pricedAssetCount: 7,
      walletUsdValue: 500,
      defiNetUsdValue: 500,
    },
    totalUsdValue: 1000,
  });

  const summary = buildPortfolioGoalFitSummary(portfolio, "Learn Slowly", null);
  assert.ok(summary.overallFitState === "Mixed" || summary.overallFitState === "Poor Fit");
  assert.match(summary.topMismatch.explanation, /complex|harder|clutter|leverage/i);
});

test("Strong long-term holdings with limited leverage fit Long-Term Growth", () => {
  const eth = makePosition({ symbol: "ETH", name: "Ether", usdValue: 450 });
  const btc = makePosition({ symbol: "BTC", name: "Bitcoin", usdValue: 350 });
  const usdc = makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 200, isStablecoin: true });
  const portfolio = makePortfolio({
    walletPositions: [eth, btc, usdc],
    aggregated: [
      makeAggregatedHolding({ symbol: "ETH", totalUsdValue: 450, positions: [eth] }),
      makeAggregatedHolding({ symbol: "BTC", totalUsdValue: 350, positions: [btc] }),
      makeAggregatedHolding({ symbol: "USDC", name: "USD Coin", totalUsdValue: 200, isStablecoin: true, positions: [usdc] }),
    ],
    totalUsdValue: 1000,
  });

  const summary = buildPortfolioGoalFitSummary(portfolio, "Long-Term Growth", null);
  assert.ok(summary.overallFitState === "Mostly Fits" || summary.overallFitState === "Strong Fit");
  assert.match(summary.topAlignedArea.explanation, /long-term|holdings|base|core/i);
});

test("Mixed allocation with moderate risk is a reasonable fit for Balanced", () => {
  const usdc = makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 250, isStablecoin: true });
  const eth = makePosition({ symbol: "ETH", name: "Ether", usdValue: 450 });
  const btc = makePosition({ symbol: "BTC", name: "Bitcoin", usdValue: 200 });
  const deposit = makePosition({ source: "defi", positionType: "deposit", symbol: "WBTC", name: "Wrapped Bitcoin", usdValue: 100, protocolName: "Morpho" });
  const portfolio = makePortfolio({
    walletPositions: [usdc, eth, btc],
    defiPositions: [deposit],
    aggregated: [
      makeAggregatedHolding({ symbol: "ETH", totalUsdValue: 450, positions: [eth] }),
      makeAggregatedHolding({ symbol: "BTC", totalUsdValue: 300, positions: [btc, deposit] }),
      makeAggregatedHolding({ symbol: "USDC", name: "USD Coin", totalUsdValue: 250, isStablecoin: true, positions: [usdc] }),
    ],
    protocolAllocations: [
      { protocolId: "morpho", protocolName: "Morpho", netUsdValue: 100, percentage: 10, category: "lending", chainSlug: "ethereum", chainName: "Ethereum", chainColor: "#627EEA" },
    ],
    summaryOverrides: {
      activeProtocolCount: 1,
      walletUsdValue: 900,
      defiNetUsdValue: 100,
      totalAssetCount: 4,
      pricedAssetCount: 4,
    },
    totalUsdValue: 1000,
  });

  const summary = buildPortfolioGoalFitSummary(portfolio, "Balanced", null);
  assert.ok(
    summary.overallFitState === "Strong Fit"
    || summary.overallFitState === "Mostly Fits"
    || summary.overallFitState === "Mixed"
  );
});

test("Goal selection persists through the chosen preference storage", () => {
  const storage = new Map<string, string>();
  const mockStorage = {
    getItem(key: string) {
      return storage.has(key) ? storage.get(key)! : null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
  };

  assert.equal(readGoalPreference(mockStorage), DEFAULT_PORTFOLIO_GOAL);
  writeGoalPreference(mockStorage, "Learn Slowly");
  assert.equal(readGoalPreference(mockStorage), "Learn Slowly");
});

test("Goal-fit engine yields a safe fallback summary with incomplete metadata", () => {
  const token = makePosition({ symbol: "TKN", name: "Unknown Token", usdValue: 40 });
  const portfolio = makePortfolio({
    walletPositions: [token],
    aggregated: [],
    summaryOverrides: {
      activeChainCount: 1,
      activeProtocolCount: 0,
      totalAssetCount: 1,
      pricedAssetCount: 1,
    },
    totalUsdValue: 40,
  });

  const summary = buildPortfolioGoalFitSummary(portfolio, "Balanced", null);
  assert.ok(summary.headline.length > 0);
  assert.ok(summary.topMismatch.explanation.length > 0);
  assert.ok(summary.topAlignedArea.explanation.length > 0);
});

test("Recommendations reflect actual mismatches", () => {
  const locked = makePosition({ source: "defi", positionType: "locked", symbol: "SEED", name: "Seedify Locked", usdValue: 500, protocolName: "Seedify" });
  const active = makePosition({ symbol: "HYPE", name: "Hyperliquid Perps", usdValue: 300, protocolId: "hyperliquid-perps", protocolName: "Hyperliquid" });
  const eth = makePosition({ symbol: "ETH", name: "Ether", usdValue: 200 });
  const portfolio = makePortfolio({
    walletPositions: [active, eth],
    defiPositions: [locked],
    aggregated: [
      makeAggregatedHolding({ symbol: "HYPE", totalUsdValue: 300, positions: [active] }),
      makeAggregatedHolding({ symbol: "SEED", totalUsdValue: 500, positions: [locked] }),
      makeAggregatedHolding({ symbol: "ETH", totalUsdValue: 200, positions: [eth] }),
    ],
    totalUsdValue: 1000,
  });

  const summary = buildPortfolioGoalFitSummary(portfolio, "Mostly Safe", null);
  assert.ok(summary.recommendations.some((item) => /leveraged positions|emergency cash|slower money/i.test(item.text)));
  assert.ok(summary.topMismatch.label.length > 0);
  assert.ok(summary.topAlignedArea.label.length > 0);
});

test("Canonical leverage priority drives Goal Mode for Mostly Safe", () => {
  const usdc = makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 800, isStablecoin: true });
  const eth = makePosition({ symbol: "ETH", name: "Ether", usdValue: 200 });
  const portfolio = makePortfolio({
    walletPositions: [usdc, eth],
    aggregated: [
      makeAggregatedHolding({ symbol: "USDC", name: "USD Coin", totalUsdValue: 800, isStablecoin: true, positions: [usdc] }),
      makeAggregatedHolding({ symbol: "ETH", totalUsdValue: 200, positions: [eth] }),
    ],
    totalUsdValue: 1000,
  });

  const summary = buildPortfolioGoalFitSummary(portfolio, "Mostly Safe", makePerps(6));
  assert.equal(summary.topMismatch.label, "Leverage");
});

test("Canonical leverage priority drives Goal Mode for Balanced when leverage is dominant", () => {
  const usdc = makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 500, isStablecoin: true });
  const eth = makePosition({ symbol: "ETH", name: "Ether", usdValue: 500 });
  const portfolio = makePortfolio({
    walletPositions: [usdc, eth],
    aggregated: [
      makeAggregatedHolding({ symbol: "USDC", name: "USD Coin", totalUsdValue: 500, isStablecoin: true, positions: [usdc] }),
      makeAggregatedHolding({ symbol: "ETH", totalUsdValue: 500, positions: [eth] }),
    ],
    totalUsdValue: 1000,
  });

  const summary = buildPortfolioGoalFitSummary(portfolio, "Balanced", makePerps(6));
  assert.equal(summary.topMismatch.label, "Leverage");
});
