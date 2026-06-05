import test from "node:test";
import assert from "node:assert/strict";
import { buildPortfolio } from "../lib/aggregate/portfolio.ts";
import { buildProtocolPositions } from "../lib/normalize/protocols.ts";
import { buildRecurringBehaviorInsights, type BehaviorWalletInput } from "../lib/behaviorInsights.ts";
import type { HistoryEvent, NormalizedPosition, PerpsApiResponse, Portfolio } from "../types/index.ts";
import type { PortfolioSnapshot } from "../lib/snapshots/index.ts";

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

function makePortfolio(
  walletPositions: NormalizedPosition[],
  defiPositions: NormalizedPosition[] = [],
  liabilities: NormalizedPosition[] = []
): Portfolio {
  const allPositions = [...walletPositions, ...defiPositions, ...liabilities];
  return buildPortfolio("0xabc", allPositions, buildProtocolPositions([...defiPositions, ...liabilities]));
}

function makePerps(): PerpsApiResponse {
  return {
    platforms: [],
    allPositions: [{
      platform: "Hyperliquid",
      chain: "Hyperliquid",
      chainColor: "#00FF7F",
      market: "BTC-PERP",
      coin: "BTC",
      side: "long",
      size: 1,
      entryPrice: 100000,
      markPrice: 100000,
      positionValue: 1000,
      unrealizedPnl: 0,
      leverage: 5,
      leverageType: "cross",
      liquidationPrice: 85000,
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
  };
}

function makeSnapshot(overrides: Partial<PortfolioSnapshot> = {}): PortfolioSnapshot {
  const timestamp = overrides.timestamp ?? new Date().toISOString();
  return {
    id: overrides.id ?? `snap-${Math.random().toString(36).slice(2)}`,
    address: overrides.address ?? "0xabc",
    timestamp,
    totalUsdValue: overrides.totalUsdValue ?? 1000,
    walletUsdValue: overrides.walletUsdValue ?? 700,
    defiNetUsdValue: overrides.defiNetUsdValue ?? 300,
    totalBorrowUsdValue: overrides.totalBorrowUsdValue ?? 0,
    perpUnrealizedPnl: overrides.perpUnrealizedPnl ?? 0,
    perpAccountValue: overrides.perpAccountValue ?? 0,
    activeChainCount: overrides.activeChainCount ?? 1,
    activeProtocolCount: overrides.activeProtocolCount ?? 0,
    assetCount: overrides.assetCount ?? 4,
    topHoldings: overrides.topHoldings ?? [{ symbol: "BTC", usdValue: 600, price: 100000 }],
    chainAllocations: overrides.chainAllocations ?? [{ chainSlug: "ethereum", chainName: "Ethereum", usdValue: 1000 }],
    protocolAllocations: overrides.protocolAllocations ?? [],
    change24h: overrides.change24h,
    change24hAbsolute: overrides.change24hAbsolute,
  };
}

function makeEvent(overrides: Partial<HistoryEvent> = {}): HistoryEvent {
  return {
    id: overrides.id ?? `evt-${Math.random().toString(36).slice(2)}`,
    type: overrides.type ?? "swap",
    description: overrides.description ?? "swap",
    chainSlug: overrides.chainSlug ?? "ethereum",
    chainName: overrides.chainName ?? "Ethereum",
    chainColor: overrides.chainColor ?? "#627EEA",
    chainEmoji: overrides.chainEmoji ?? "⬡",
    tokenSymbol: overrides.tokenSymbol ?? "USDC",
    tokenAmount: overrides.tokenAmount ?? 100,
    toTokenSymbol: overrides.toTokenSymbol ?? "SOL",
    toTokenAmount: overrides.toTokenAmount ?? 1,
    usdValue: overrides.usdValue ?? 100,
    counterparty: overrides.counterparty,
    txHash: overrides.txHash ?? `0x${Math.random().toString(16).slice(2)}`,
    explorerUrl: overrides.explorerUrl,
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    status: overrides.status ?? "confirmed",
    fee: overrides.fee,
    dataSource: overrides.dataSource ?? "zerion",
  };
}

test("Multi-wallet data can produce a cross-wallet leverage insight", () => {
  const wallets: BehaviorWalletInput[] = [
    {
      address: "0x1",
      label: "Trading One",
      portfolio: makePortfolio([makePosition({ symbol: "BTC", usdValue: 800 }), makePosition({ symbol: "USDC", usdValue: 200, isStablecoin: true })]),
      perps: makePerps(),
      snapshots: [makeSnapshot({ address: "0x1", perpAccountValue: 120 }), makeSnapshot({ address: "0x1", perpAccountValue: 150 })],
    },
    {
      address: "0x2",
      label: "Trading Two",
      portfolio: makePortfolio([makePosition({ symbol: "ETH", usdValue: 700 }), makePosition({ symbol: "USDC", usdValue: 300, isStablecoin: true })]),
      perps: makePerps(),
      snapshots: [makeSnapshot({ address: "0x2", perpAccountValue: 80 }), makeSnapshot({ address: "0x2", perpAccountValue: 90 })],
    },
  ];

  const summary = buildRecurringBehaviorInsights(wallets, "Balanced");
  const insight = summary.insights.find((item) => item.type === "leverage");
  assert.ok(insight);
  assert.equal(insight?.appliesTo, "all_tracked_wallets");
});

test("A pattern isolated to one wallet is labeled as one-wallet", () => {
  const wallets: BehaviorWalletInput[] = [
    {
      address: "0x1",
      label: "Trading One",
      portfolio: makePortfolio([makePosition({ symbol: "BTC", usdValue: 800 })]),
      perps: makePerps(),
      snapshots: [makeSnapshot({ address: "0x1", perpAccountValue: 120 }), makeSnapshot({ address: "0x1", perpAccountValue: 140 })],
    },
    {
      address: "0x2",
      label: "Calm Wallet",
      portfolio: makePortfolio([makePosition({ symbol: "USDC", usdValue: 1000, isStablecoin: true })]),
      snapshots: [makeSnapshot({ address: "0x2", perpAccountValue: 0 })],
    },
  ];

  const summary = buildRecurringBehaviorInsights(wallets, "Mostly Safe");
  const insight = summary.insights.find((item) => item.type === "leverage");
  assert.ok(insight);
  assert.equal(insight?.appliesTo, "one_wallet");
});

test("DeFi-heavy histories produce protocol dependence insight", () => {
  const portfolio = makePortfolio(
    [makePosition({ symbol: "USDC", usdValue: 200, isStablecoin: true })],
    [makePosition({ source: "defi", positionType: "deposit", symbol: "ETH", usdValue: 800, protocolId: "aave", protocolName: "Aave" })]
  );
  const summary = buildRecurringBehaviorInsights([{
    address: "0x1",
    label: "DeFi Wallet",
    portfolio,
    snapshots: [
      makeSnapshot({ protocolAllocations: [{ protocolId: "aave", protocolName: "Aave", usdValue: 700 }], totalUsdValue: 1000 }),
      makeSnapshot({ protocolAllocations: [{ protocolId: "aave", protocolName: "Aave", usdValue: 750 }], totalUsdValue: 1000 }),
    ],
  }], "Balanced");

  assert.ok(summary.insights.some((item) => item.type === "protocol_dependence"));
});

test("Repeated low defensive cash produces defensive-cash insight", () => {
  const portfolio = makePortfolio([
    makePosition({ symbol: "SOL", usdValue: 900 }),
    makePosition({ symbol: "USDC", usdValue: 100, isStablecoin: true }),
  ]);
  const summary = buildRecurringBehaviorInsights([{
    address: "0x1",
    label: "Risk Wallet",
    portfolio,
    historyEvents: [
      makeEvent({ usdValue: 100, tokenSymbol: "USDC", toTokenSymbol: "SOL", type: "swap" }),
      makeEvent({ usdValue: 120, tokenSymbol: "USDC", toTokenSymbol: "BTC", type: "swap" }),
      makeEvent({ usdValue: 140, tokenSymbol: "USDC", toTokenSymbol: "ETH", type: "swap" }),
    ],
  }], "Mostly Safe");

  assert.ok(summary.insights.some((item) => item.type === "defensive_cash"));
});

test("Repeated fragmentation produces fragmentation insight", () => {
  const portfolio = makePortfolio(new Array(14).fill(null).map((_, index) =>
    makePosition({ symbol: `T${index}`, usdValue: index === 0 ? 300 : 20 })
  ));
  const summary = buildRecurringBehaviorInsights([{
    address: "0x1",
    label: "Fragmented Wallet",
    portfolio,
    snapshots: [
      makeSnapshot({ assetCount: 14, activeChainCount: 4, activeProtocolCount: 3 }),
      makeSnapshot({ assetCount: 15, activeChainCount: 4, activeProtocolCount: 4 }),
    ],
    historyEvents: [
      makeEvent({ type: "receive", usdValue: 2, tokenSymbol: "SPAM" }),
      makeEvent({ type: "receive", usdValue: 1, tokenSymbol: "DUST" }),
    ],
  }], "Learn Slowly");

  assert.ok(summary.insights.some((item) => item.type === "fragmentation"));
});

test("Goal-fit drift can be detected when safer goals keep conflicting with behavior", () => {
  const summary = buildRecurringBehaviorInsights([{
    address: "0x1",
    label: "Mixed Wallet",
    portfolio: makePortfolio([makePosition({ symbol: "BTC", usdValue: 800 }), makePosition({ symbol: "USDC", usdValue: 200, isStablecoin: true })]),
    perps: makePerps(),
    snapshots: [makeSnapshot({ perpAccountValue: 120 }), makeSnapshot({ perpAccountValue: 130 })],
  }], "Mostly Safe");

  assert.ok(summary.insights.some((item) => item.type === "goal_drift"));
});

test("Sparse history lowers confidence and reduces insight count", () => {
  const summary = buildRecurringBehaviorInsights([{
    address: "0x1",
    label: "Sparse Wallet",
    snapshots: [makeSnapshot({ totalUsdValue: 100 })],
  }], "Balanced");

  assert.equal(summary.insights.length, 0);
});

test("Cross-wallet versus one-wallet wording stays obvious", () => {
  const multi = buildRecurringBehaviorInsights([{
    address: "0x1",
    label: "Trading One",
    portfolio: makePortfolio([makePosition({ symbol: "BTC", usdValue: 800 })]),
    perps: makePerps(),
    snapshots: [makeSnapshot({ address: "0x1", perpAccountValue: 120 }), makeSnapshot({ address: "0x1", perpAccountValue: 140 })],
  }, {
    address: "0x2",
    label: "Trading Two",
    portfolio: makePortfolio([makePosition({ symbol: "ETH", usdValue: 800 })]),
    perps: makePerps(),
    snapshots: [makeSnapshot({ address: "0x2", perpAccountValue: 120 }), makeSnapshot({ address: "0x2", perpAccountValue: 140 })],
  }], "Balanced");

  const single = buildRecurringBehaviorInsights([{
    address: "0x1",
    label: "Trading One",
    portfolio: makePortfolio([makePosition({ symbol: "BTC", usdValue: 800 })]),
    perps: makePerps(),
    snapshots: [makeSnapshot({ address: "0x1", perpAccountValue: 120 }), makeSnapshot({ address: "0x1", perpAccountValue: 140 })],
  }, {
    address: "0x2",
    label: "Calm Wallet",
    portfolio: makePortfolio([makePosition({ symbol: "USDC", usdValue: 1000, isStablecoin: true })]),
    snapshots: [makeSnapshot({ address: "0x2", perpAccountValue: 0 })],
  }], "Mostly Safe");

  assert.match(multi.insights[0]?.summary ?? "", /across all tracked wallets|across multiple wallets/i);
  const oneWalletInsight = single.insights.find((item) => item.type === "leverage");
  assert.match(oneWalletInsight?.summary ?? "", /concentrated in/i);
});

test("Top insight set stays useful instead of filling with weak patterns", () => {
  const summary = buildRecurringBehaviorInsights([{
    address: "0x1",
    label: "Active Wallet",
    portfolio: makePortfolio(
      [makePosition({ symbol: "BTC", usdValue: 500 }), makePosition({ symbol: "USDC", usdValue: 100, isStablecoin: true })],
      [makePosition({ source: "defi", positionType: "deposit", symbol: "ETH", usdValue: 400, protocolId: "aave", protocolName: "Aave" })]
    ),
    perps: makePerps(),
    snapshots: [
      makeSnapshot({ perpAccountValue: 120, protocolAllocations: [{ protocolId: "aave", protocolName: "Aave", usdValue: 400 }], assetCount: 13 }),
      makeSnapshot({ perpAccountValue: 140, protocolAllocations: [{ protocolId: "aave", protocolName: "Aave", usdValue: 420 }], assetCount: 14 }),
    ],
    historyEvents: [
      makeEvent({ usdValue: 120, tokenSymbol: "USDC", toTokenSymbol: "BTC", type: "swap" }),
      makeEvent({ usdValue: 130, tokenSymbol: "USDC", toTokenSymbol: "ETH", type: "swap" }),
      makeEvent({ usdValue: 140, type: "deposit", tokenSymbol: "ETH" }),
    ],
  }], "Balanced");

  assert.ok(summary.insights.length <= 5);
  assert.ok(summary.insights.every((item) => item.supportingSignals.length >= 2));
  if (summary.insights[0]) {
    assert.notEqual(summary.insights[0].confidence, "Low");
  }
});

test("Single-wallet fallback works without pretending to be cross-wallet", () => {
  const summary = buildRecurringBehaviorInsights([{
    address: "0x1",
    label: "Solo Wallet",
    portfolio: makePortfolio([makePosition({ symbol: "BTC", usdValue: 1000 })]),
  }], "Balanced");

  assert.equal(summary.scope, "single_wallet");
  assert.match(summary.coverageNote ?? "", /one wallet only/i);
});

test("Insight text remains beginner-friendly and non-creepy", () => {
  const summary = buildRecurringBehaviorInsights([{
    address: "0x1",
    label: "Solo Wallet",
    portfolio: makePortfolio([makePosition({ symbol: "BTC", usdValue: 800 }), makePosition({ symbol: "USDC", usdValue: 200, isStablecoin: true })]),
    perps: makePerps(),
    snapshots: [makeSnapshot({ perpAccountValue: 100 }), makeSnapshot({ perpAccountValue: 120 })],
  }], "Balanced");

  const text = summary.insights.map((item) => `${item.title} ${item.summary} ${item.recommendation ?? ""}`).join(" ");
  assert.doesNotMatch(text, /watched all your wallets|bad choices|reckless|degenerate/i);
});
