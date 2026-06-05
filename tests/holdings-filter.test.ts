import test from "node:test";
import assert from "node:assert/strict";
import { aggregateHoldings } from "../lib/aggregate/holdings.ts";
import { filterDust } from "../lib/aggregate/portfolio.ts";
import { portfolioWithPerpsAccountValue } from "../lib/aggregate/perpsPortfolio.ts";
import type { NormalizedPosition, PerpsApiResponse, Portfolio } from "../types/index.ts";

function makePosition(overrides: Partial<NormalizedPosition> = {}): NormalizedPosition {
  const balance = overrides.balance ?? 1;
  const price = overrides.price ?? 1;
  const usdValue = overrides.usdValue ?? balance * price;

  return {
    id: overrides.id ?? "position",
    symbol: overrides.symbol ?? "TOKEN",
    name: overrides.name ?? "Token",
    logo: overrides.logo,
    contractAddress: overrides.contractAddress ?? "token",
    decimals: overrides.decimals ?? 18,
    fungibleId: overrides.fungibleId,
    coingeckoId: overrides.coingeckoId,
    chainSlug: overrides.chainSlug ?? "ethereum",
    chainName: overrides.chainName ?? "Ethereum",
    chainNumericId: overrides.chainNumericId,
    chainColor: overrides.chainColor ?? "#627EEA",
    chainEmoji: overrides.chainEmoji ?? "E",
    balance,
    rawBalance: overrides.rawBalance ?? String(balance),
    price,
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

test("Hyperliquid perp equity stays visible in holdings filters", () => {
  const aggregated = aggregateHoldings([
    makePosition({
      id: "hyperliquid-perp-equity",
      symbol: "USDC",
      name: "Hyperliquid Perp Equity",
      contractAddress: "hyperliquid-perp-equity",
      decimals: 6,
      chainSlug: "hyperliquid",
      chainName: "Hyperliquid",
      chainColor: "#00FF79",
      chainEmoji: "HL",
      balance: 3,
      rawBalance: "3000000",
      price: 1,
      usdValue: 3,
      priceAvailable: true,
      isStablecoin: true,
      dataSource: "hyperliquid",
      protocolId: "hyperliquid-perps",
      protocolName: "Hyperliquid Perps",
    }),
  ]);

  assert.equal(filterDust(aggregated).length, 1);
  assert.equal(filterDust(aggregated)[0].aggregateKey, "isolated:hyperliquid:hyperliquid-perp-equity");
});

test("core Hyperliquid HYPE balance stays visible even below normal dust threshold", () => {
  const aggregated = aggregateHoldings([
    makePosition({
      id: "hyperliquid-hype",
      symbol: "HYPE",
      name: "Hyperliquid",
      contractAddress: "hype",
      chainSlug: "hyperliquid",
      chainName: "Hyperliquid",
      chainColor: "#00FF79",
      chainEmoji: "HL",
      balance: 0.05,
      rawBalance: "50000000000000000",
      price: 10,
      usdValue: 0.5,
      priceAvailable: true,
      dataSource: "hyperliquid",
      protocolId: "hyperliquid",
      protocolName: "Hyperliquid",
    }),
  ]);

  assert.equal(filterDust(aggregated).length, 1);
});

test("regular priced dust remains hidden", () => {
  const aggregated = aggregateHoldings([
    makePosition({
      id: "regular-dust",
      symbol: "DUST",
      balance: 1,
      price: 1,
      usdValue: 1,
      priceAvailable: true,
    }),
  ]);

  assert.equal(filterDust(aggregated).length, 0);
});

test("ETH and uETH aggregate into one Ethereum exposure holding", () => {
  const aggregated = aggregateHoldings([
    makePosition({
      id: "eth-wallet",
      symbol: "ETH",
      name: "Ether",
      contractAddress: "native",
      balance: 1,
      price: 3000,
      usdValue: 3000,
      isNative: true,
    }),
    makePosition({
      id: "morpho-ueth",
      symbol: "uETH",
      name: "Universal ETH (Morpho Vault)",
      contractAddress: "0xueth",
      balance: 0.5,
      price: 3000,
      usdValue: 1500,
      source: "defi",
      positionType: "deposit",
      protocolId: "morpho",
      protocolName: "Morpho",
    }),
  ]);

  assert.equal(aggregated.length, 1);
  assert.equal(aggregated[0].aggregateKey, "underlying:ETH");
  assert.equal(aggregated[0].symbol, "ETH");
  assert.equal(aggregated[0].totalUsdValue, 4500);
  assert.equal(aggregated[0].positions.length, 2);
});

test("ETH liquid staking and restaking variants aggregate into Ethereum exposure", () => {
  const aggregated = aggregateHoldings([
    makePosition({
      id: "wsteth",
      symbol: "wstETH",
      name: "Wrapped stETH",
      balance: 1,
      price: 3600,
      usdValue: 3600,
      source: "defi",
      positionType: "staked",
      protocolId: "lido",
      protocolName: "Lido",
    }),
    makePosition({
      id: "rseth",
      symbol: "rsETH",
      name: "Kelp DAO Restaked ETH",
      balance: 2,
      price: 3000,
      usdValue: 6000,
      source: "defi",
      positionType: "deposit",
      protocolId: "kelp",
      protocolName: "Kelp DAO",
    }),
  ]);

  assert.equal(aggregated.length, 1);
  assert.equal(aggregated[0].aggregateKey, "underlying:ETH");
  assert.equal(aggregated[0].symbol, "ETH");
  assert.equal(aggregated[0].totalUsdValue, 9600);
  assert.equal(aggregated[0].positions.map((position) => position.symbol).sort().join(","), "rsETH,wstETH");
});

function makePortfolio(positions: NormalizedPosition[]): Portfolio {
  const aggregated = aggregateHoldings(positions);
  const totalUsdValue = positions.reduce((sum, position) => sum + (position.usdValue ?? 0), 0);

  return {
    address: "0xabc",
    walletPositions: positions,
    defiPositions: [],
    liabilities: [],
    protocols: [],
    aggregated,
    chainAllocations: [],
    protocolAllocations: [],
    summary: {
      totalUsdValue,
      walletUsdValue: totalUsdValue,
      defiNetUsdValue: 0,
      totalBorrowUsdValue: 0,
      activeChainCount: new Set(positions.map((position) => position.chainSlug)).size,
      activeProtocolCount: 0,
      pricedAssetCount: positions.filter((position) => position.priceAvailable).length,
      totalAssetCount: positions.length,
      largestHolding: aggregated[0],
    },
    lastUpdated: "2026-05-02T00:00:00.000Z",
  };
}

function makePerpsResponse(accountValue: number, withdrawable = accountValue): PerpsApiResponse {
  return {
    platforms: [{
      platform: "Hyperliquid",
      chain: "Hyperliquid L1",
      chainColor: "#00FF79",
      positions: [],
      accountSummary: {
        accountValue,
        totalMarginUsed: 0,
        totalNtlPos: 0,
        withdrawable,
      },
      pnl: {
        realizedPnl: 0,
        unrealizedPnl: 0,
        totalFunding: 0,
        totalFees: 0,
        netLifetime: 0,
        pnlByMarket: [],
        fillCount: 0,
        isExact: true,
        dataNote: "Exact.",
      },
    }],
    allPositions: [],
    totalUnrealizedPnl: 0,
    totalRealizedPnl: 0,
    totalFunding: 0,
    totalFees: 0,
    netLifetimePnl: 0,
    totalAccountValue: Math.max(accountValue, withdrawable),
    openPositionCount: 0,
    hasAnyPositions: false,
    isPartialData: false,
  };
}

test("portfolio totals include Hyperliquid perps account value when portfolio endpoint missed it", () => {
  const portfolio = makePortfolio([
    makePosition({
      id: "eth",
      symbol: "ETH",
      name: "Ether",
      balance: 1,
      price: 1000,
      usdValue: 1000,
    }),
  ]);

  const augmented = portfolioWithPerpsAccountValue(portfolio, makePerpsResponse(250));

  assert.equal(augmented?.summary.totalUsdValue, 1250);
  assert.equal(augmented?.summary.walletUsdValue, 1250);
  assert.equal(
    augmented?.aggregated.some((holding) => holding.positions.some((position) => position.protocolId === "hyperliquid-perps")),
    true
  );
});

test("portfolio totals include idle Hyperliquid withdrawable USDC when account value is zero", () => {
  const portfolio = makePortfolio([
    makePosition({
      id: "eth",
      symbol: "ETH",
      name: "Ether",
      balance: 1,
      price: 1000,
      usdValue: 1000,
    }),
  ]);

  const augmented = portfolioWithPerpsAccountValue(portfolio, makePerpsResponse(0, 250));

  assert.equal(augmented?.summary.totalUsdValue, 1250);
  assert.equal(
    augmented?.aggregated.some((holding) => holding.positions.some((position) => position.protocolId === "hyperliquid-perps")),
    true
  );
});

test("portfolio totals do not double-count Hyperliquid perps when already present", () => {
  const portfolio = makePortfolio([
    makePosition({
      id: "hyperliquid-perp-equity",
      symbol: "USDC",
      name: "Hyperliquid Perp Equity",
      contractAddress: "hyperliquid-perp-equity",
      balance: 250,
      price: 1,
      usdValue: 250,
      priceAvailable: true,
      dataSource: "hyperliquid",
      protocolId: "hyperliquid-perps",
      protocolName: "Hyperliquid Perps",
    }),
  ]);

  const augmented = portfolioWithPerpsAccountValue(portfolio, makePerpsResponse(250));

  assert.equal(augmented?.summary.totalUsdValue, 250);
  assert.equal(augmented?.walletPositions.length, 1);
});

test("portfolio total drops when live Hyperliquid perp value falls below the snapshot", () => {
  const portfolio = makePortfolio([
    makePosition({ id: "eth", symbol: "ETH", name: "Ether", balance: 1, price: 1000, usdValue: 1000 }),
    makePosition({
      id: "hyperliquid-perp-equity",
      symbol: "USDC",
      name: "Hyperliquid Perp Equity",
      contractAddress: "hyperliquid-perp-equity",
      balance: 250,
      price: 1,
      usdValue: 250,
      priceAvailable: true,
      dataSource: "hyperliquid",
      protocolId: "hyperliquid-perps",
      protocolName: "Hyperliquid Perps",
    }),
  ]);

  // Snapshot total is 1250; live perp equity dropped from 250 to 200.
  const augmented = portfolioWithPerpsAccountValue(portfolio, makePerpsResponse(200));

  assert.equal(augmented?.summary.totalUsdValue, 1200);
  assert.equal(augmented?.summary.walletUsdValue, 1200);
  const perp = augmented?.walletPositions.find((p) => p.id === "hyperliquid-perp-equity");
  assert.equal(perp?.usdValue, 200);
  assert.equal(augmented?.walletPositions.length, 2);
});

test("portfolio keeps its snapshot perp value when no live perps data is available", () => {
  const portfolio = makePortfolio([
    makePosition({ id: "eth", symbol: "ETH", name: "Ether", balance: 1, price: 1000, usdValue: 1000 }),
    makePosition({
      id: "hyperliquid-perp-equity",
      symbol: "USDC",
      name: "Hyperliquid Perp Equity",
      contractAddress: "hyperliquid-perp-equity",
      balance: 250,
      price: 1,
      usdValue: 250,
      priceAvailable: true,
      dataSource: "hyperliquid",
      protocolId: "hyperliquid-perps",
      protocolName: "Hyperliquid Perps",
    }),
  ]);

  // perps feed still loading (null) — must not zero out the snapshot equity.
  assert.equal(portfolioWithPerpsAccountValue(portfolio, null)?.summary.totalUsdValue, 1250);
  assert.equal(portfolioWithPerpsAccountValue(portfolio, undefined)?.summary.totalUsdValue, 1250);
});
