import test from "node:test";
import assert from "node:assert/strict";
import { buildFirstWalletCheckup } from "../lib/walletCheckup.ts";
import {
  dismissWalletCheckup,
  markWalletCheckupSeen,
  readWalletCheckupPreference,
  resetWalletCheckupDismissed,
} from "../lib/walletCheckupPreference.ts";
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

test("Large active trades and leverage trend the wallet style toward active trading", () => {
  const active = makePosition({ symbol: "HYPE", name: "Hyperliquid Perps", usdValue: 450, protocolId: "hyperliquid-perps", protocolName: "Hyperliquid" });
  const usdc = makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 550, isStablecoin: true });
  const portfolio = makePortfolio({
    walletPositions: [active, usdc],
    aggregated: [
      makeAggregatedHolding({ symbol: "HYPE", name: "Hyperliquid Perps", totalUsdValue: 450, positions: [active] }),
      makeAggregatedHolding({ symbol: "USDC", name: "USD Coin", totalUsdValue: 550, isStablecoin: true, positions: [usdc] }),
    ],
    totalUsdValue: 1000,
  });

  const summary = buildFirstWalletCheckup(portfolio, "Balanced", makePerps(6));
  assert.match(summary.walletStyle.label, /Active Trader|Aggressive Mix/);
});

test("Large DeFi Earn share makes DeFi the dominant area", () => {
  const deposit = makePosition({ source: "defi", positionType: "deposit", symbol: "ETH", name: "Ether", usdValue: 700, protocolName: "Morpho", protocolId: "morpho" });
  const usdc = makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 300, isStablecoin: true });
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
    totalDepositUsd: 700,
    totalBorrowUsd: 0,
    totalRewardUsd: 0,
    totalStakedUsd: 0,
    netUsdValue: 700,
  };
  const portfolio = makePortfolio({
    walletPositions: [usdc],
    defiPositions: [deposit],
    protocols: [protocol],
    aggregated: [
      makeAggregatedHolding({ symbol: "ETH", totalUsdValue: 700, positions: [deposit] }),
      makeAggregatedHolding({ symbol: "USDC", name: "USD Coin", totalUsdValue: 300, isStablecoin: true, positions: [usdc] }),
    ],
    protocolAllocations: [{ protocolId: "morpho", protocolName: "Morpho", netUsdValue: 700, percentage: 70, category: "lending", chainSlug: "ethereum", chainName: "Ethereum", chainColor: "#627EEA" }],
    totalUsdValue: 1000,
  });

  const summary = buildFirstWalletCheckup(portfolio, "Balanced", null);
  assert.equal(summary.dominantArea.label, "DeFi Earn");
});

test("High safe cash and low risk trend defensive style with lower complexity", () => {
  const usdc = makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 800, isStablecoin: true });
  const eth = makePosition({ symbol: "ETH", name: "Ether", usdValue: 200 });
  const portfolio = makePortfolio({
    walletPositions: [usdc, eth],
    aggregated: [
      makeAggregatedHolding({ symbol: "USDC", name: "USD Coin", totalUsdValue: 800, isStablecoin: true, positions: [usdc] }),
      makeAggregatedHolding({ symbol: "ETH", totalUsdValue: 200, positions: [eth] }),
    ],
    summaryOverrides: { activeChainCount: 1, activeProtocolCount: 0, totalAssetCount: 2, pricedAssetCount: 2 },
    totalUsdValue: 1000,
  });

  const summary = buildFirstWalletCheckup(portfolio, "Mostly Safe", null);
  assert.equal(summary.walletStyle.label, "Defensive Cash");
  assert.equal(summary.complexity.level, "Low");
});

test("Many chains, dust, and mixed activity raise complexity", () => {
  const dustA = makePosition({ symbol: "AAA", name: "Token AAA", usdValue: 5, chainSlug: "arbitrum", chainName: "Arbitrum" });
  const dustB = makePosition({ symbol: "BBB", name: "Token BBB", usdValue: 5, chainSlug: "base", chainName: "Base" });
  const active = makePosition({ symbol: "HYPE", name: "Hyperliquid Perps", usdValue: 150, protocolId: "hyperliquid-perps", protocolName: "Hyperliquid" });
  const deposit = makePosition({ source: "defi", positionType: "deposit", symbol: "ETH", name: "Ether", usdValue: 300, protocolName: "Morpho" });
  const locked = makePosition({ source: "defi", positionType: "locked", symbol: "JTO", name: "Jito Locked", usdValue: 200, protocolName: "Jito" });
  const spot = makePosition({ symbol: "BTC", name: "Bitcoin", usdValue: 340 });
  const portfolio = makePortfolio({
    walletPositions: [active, spot, dustA, dustB],
    defiPositions: [deposit, locked],
    aggregated: [
      makeAggregatedHolding({ symbol: "HYPE", totalUsdValue: 150, positions: [active] }),
      makeAggregatedHolding({ symbol: "ETH", totalUsdValue: 300, positions: [deposit] }),
      makeAggregatedHolding({ symbol: "JTO", totalUsdValue: 200, positions: [locked] }),
      makeAggregatedHolding({ symbol: "BTC", totalUsdValue: 340, positions: [spot] }),
      makeAggregatedHolding({ symbol: "AAA", totalUsdValue: 5, positions: [dustA] }),
      makeAggregatedHolding({ symbol: "BBB", totalUsdValue: 5, positions: [dustB] }),
    ],
    summaryOverrides: { activeChainCount: 4, activeProtocolCount: 2, totalAssetCount: 6, pricedAssetCount: 6 },
    totalUsdValue: 1000,
  });

  const summary = buildFirstWalletCheckup(portfolio, "Learn Slowly", makePerps(4));
  assert.equal(summary.complexity.level, "High");
});

test("Biggest risk matches canonical unified risk truth", () => {
  const portfolio = makePortfolio({
    walletPositions: [makePosition({ symbol: "USDC", name: "USD Coin", usdValue: 1000, isStablecoin: true })],
    aggregated: [makeAggregatedHolding({ symbol: "USDC", name: "USD Coin", totalUsdValue: 1000, isStablecoin: true, positions: [] })],
    totalUsdValue: 1000,
  });

  const summary = buildFirstWalletCheckup(portfolio, "Mostly Safe", makePerps(6));
  assert.match(summary.biggestRisk.explanation, /leverage/i);
  assert.match(summary.biggestRisk.label, /Perp leverage|leverage/i);
});

test("Goal fit summary uses the selected goal", () => {
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

  const summary = buildFirstWalletCheckup(portfolio, "Learn Slowly", null);
  assert.equal(summary.goalFit.goal, "Learn Slowly");
});

test("First things to understand reflect actual conditions", () => {
  const locked = makePosition({ source: "defi", positionType: "locked", symbol: "SEED", name: "Seedify Locked", usdValue: 300, protocolName: "Seedify" });
  const deposit = makePosition({ source: "defi", positionType: "deposit", symbol: "ETH", name: "Ether", usdValue: 400, protocolName: "Morpho", protocolId: "morpho" });
  const spot = makePosition({ symbol: "BTC", name: "Bitcoin", usdValue: 300 });
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
    totalDepositUsd: 400,
    totalBorrowUsd: 0,
    totalRewardUsd: 0,
    totalStakedUsd: 0,
    netUsdValue: 400,
  };
  const portfolio = makePortfolio({
    walletPositions: [spot],
    defiPositions: [deposit, locked],
    protocols: [protocol],
    aggregated: [
      makeAggregatedHolding({ symbol: "BTC", totalUsdValue: 300, positions: [spot] }),
      makeAggregatedHolding({ symbol: "ETH", totalUsdValue: 400, positions: [deposit] }),
      makeAggregatedHolding({ symbol: "SEED", totalUsdValue: 300, positions: [locked] }),
    ],
    protocolAllocations: [{ protocolId: "morpho", protocolName: "Morpho", netUsdValue: 400, percentage: 57, category: "lending", chainSlug: "ethereum", chainName: "Ethereum", chainColor: "#627EEA" }],
    totalUsdValue: 1000,
  });

  const summary = buildFirstWalletCheckup(portfolio, "Mostly Safe", makePerps(6));
  assert.ok(summary.firstThingsToUnderstand.some((item) => /leveraged position/i.test(item.text)));
  assert.ok(summary.firstThingsToUnderstand.some((item) => /quick exits|extra steps/i.test(item.text)));
});

test("Seen and dismissed state persists per wallet", () => {
  const storage = new Map<string, string>();
  const mockStorage = {
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
  };

  assert.deepEqual(readWalletCheckupPreference(mockStorage, "0xABC"), {});
  markWalletCheckupSeen(mockStorage, "0xABC");
  assert.ok(readWalletCheckupPreference(mockStorage, "0xabc").seenAt);
  dismissWalletCheckup(mockStorage, "0xABC");
  assert.ok(readWalletCheckupPreference(mockStorage, "0xabc").dismissedAt);
  resetWalletCheckupDismissed(mockStorage, "0xabc");
  assert.equal(readWalletCheckupPreference(mockStorage, "0xabc").dismissedAt, undefined);
});

test("Incomplete metadata still returns a safe fallback checkup", () => {
  const token = makePosition({ symbol: "TKN", name: "Unknown Token", usdValue: 40 });
  const portfolio = makePortfolio({
    walletPositions: [token],
    aggregated: [],
    summaryOverrides: { totalAssetCount: 1, pricedAssetCount: 0, activeProtocolCount: 0 },
    totalUsdValue: 40,
  });

  const summary = buildFirstWalletCheckup(portfolio, "Balanced", null);
  assert.ok(summary.walletStyle.label.length > 0);
  assert.ok(summary.biggestRisk.explanation.length > 0);
  assert.ok(summary.firstThingsToUnderstand.length > 0);
});
