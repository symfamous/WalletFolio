/**
 * lib/providers/perps/hyperliquid.ts
 *
 * Hyperliquid public API adapter.
 * Endpoint: https://api.hyperliquid.xyz/info (no auth required)
 *
 * Data quality:
 *   positions       → exact (real-time clearinghouse state)
 *   unrealizedPnl   → exact (from clearinghouse)
 *   realizedPnl     → exact if < ~10k fills; estimated/partial if truncated
 *   funding         → exact from userFunding history
 *   fees            → exact from fill data
 */

import type { NormalizedPerpPosition, NormalizedPerpPlatform } from "./types";
import { ProviderRequestError, providerFetchJson } from "@/lib/providers/resilience";

const HL_URL     = "https://api.hyperliquid.xyz/info";
const TIMEOUT_MS = 8_000;

async function hlPost<T>(body: { type: string; [key: string]: unknown }): Promise<T | null> {
  try {
    return await providerFetchJson<T>(
      "hyperliquid",
      HL_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      { timeoutMs: TIMEOUT_MS, retries: { server_error: 1, network: 1 } }
    );
  } catch (err) {
    const isSocketError = err instanceof TypeError && String(err).includes("fetch failed");
    const message = err instanceof ProviderRequestError ? err.message : err;
    console.warn(`[hyperliquid] hlPost error for ${body.type}:`, isSocketError ? "socket closed" : message);
    return null;
  }
}

interface HLPosition {
  coin: string; szi: string; entryPx: string; positionValue: string;
  unrealizedPnl: string; returnOnEquity: string; liquidationPx: string | null;
  marginUsed: string; maxLeverage: number;
  leverage: { type: "isolated" | "cross"; value: number };
  cumFunding: { allTime: string; sinceOpen: string; sinceChange: string };
}
interface HLState {
  assetPositions: Array<{ position: HLPosition; type: string }>;
  marginSummary: { accountValue: string; totalMarginUsed: string; totalNtlPos: string };
  crossMarginSummary: { accountValue: string; totalMarginUsed: string; totalNtlPos: string };
  withdrawable: string;
}
interface HLFill {
  coin: string; px: string; sz: string; side: "B"|"A"; time: number;
  closedPnl: string; fee: string; hash: string;
}
interface HLFunding {
  coin: string; time: number; usdc: string;
  delta?: { usdc?: string };
}

export async function fetchHyperliquidPerps(address: string): Promise<NormalizedPerpPlatform> {
  const [state, fills, funding, spotState] = await Promise.all([
    hlPost<HLState>({ type: "clearinghouseState", user: address }),
    hlPost<HLFill[]>({ type: "userFills",         user: address }),
    hlPost<HLFunding[]>({ type: "userFunding",    user: address }),
    hlPost<{ balances?: Array<{ coin: string; total: string; hold: string }> }>({
      type: "spotClearinghouseState",
      user: address,
    }),
  ]);

  const safeState   = state;
  const safeFills   = fills   ?? [];
  const safeFunding = funding ?? [];

  // ── Open positions ────────────────────────────────────────────
  const positions: NormalizedPerpPosition[] = (safeState?.assetPositions ?? [])
    .filter((ap) => ap?.position && parseFloat(ap.position.szi ?? "0") !== 0)
    .map((ap): NormalizedPerpPosition => {
      const p       = ap.position;
      const size    = parseFloat(p.szi ?? "0");
      const absSize = Math.abs(size);
      const posVal  = parseFloat(p.positionValue ?? "0");
      const markPx  = absSize > 0 ? posVal / absSize : 0;
      const liqPx   = p.liquidationPx ? parseFloat(p.liquidationPx) : null;
      const liqDist = liqPx && markPx > 0 ? Math.abs((markPx - liqPx) / markPx) * 100 : null;

      return {
        platform:         "Hyperliquid",
        chain:            "Hyperliquid L1",
        chainColor:       "#00FF79",
        market:           `${p.coin}-PERP`,
        coin:             p.coin,
        side:             size > 0 ? "long" : "short",
        size:             absSize,
        entryPrice:       parseFloat(p.entryPx ?? "0"),
        markPrice:        markPx,
        positionValue:    posVal,
        unrealizedPnl:    parseFloat(p.unrealizedPnl ?? "0"),
        leverage:         p.leverage?.value ?? 1,
        leverageType:     p.leverage?.type ?? "cross",
        liquidationPrice: liqPx,
        liqDistancePct:   liqDist,
        marginUsed:       parseFloat(p.marginUsed ?? "0"),
        fundingSinceOpen: parseFloat(p.cumFunding?.sinceOpen ?? "0"),
        returnOnEquity:   parseFloat(p.returnOnEquity ?? "0"),
        riskLevel:
          liqDist !== null
            ? liqDist < 5 ? "critical" : liqDist < 15 ? "warning" : "safe"
            : "safe",
        status: "open",
        isExact: true,
      };
    });

  // ── PnL from fills ────────────────────────────────────────────
  let realizedPnl = 0, totalFees = 0;
  const pnlByCoin: Record<string, number> = {};
  for (const f of safeFills) {
    const cpnl = parseFloat(f.closedPnl ?? "0");
    const fee  = parseFloat(f.fee ?? "0");
    realizedPnl += cpnl;
    totalFees   += fee;
    pnlByCoin[f.coin] = (pnlByCoin[f.coin] ?? 0) + cpnl;
  }

  let totalFunding = 0;
  for (const f of safeFunding) {
    totalFunding += parseFloat(f.usdc ?? f.delta?.usdc ?? "0");
  }

  const unrealizedTotal = positions.reduce((s, p) => s + p.unrealizedPnl, 0);
  const isTruncated     = safeFills.length >= 9999;

  const spotUsdcBalance = spotState?.balances
    ?.filter((balance) => balance.coin?.toUpperCase() === "USDC")
    .reduce((sum, balance) => sum + parseFloat(balance.total ?? "0"), 0) ?? 0;

  const accountSummary = safeState || spotUsdcBalance > 0 ? {
    // marginSummary includes both cross and isolated perp collateral.
    accountValue:      parseFloat(safeState?.marginSummary?.accountValue    ?? "0"),
    totalMarginUsed:   parseFloat(safeState?.marginSummary?.totalMarginUsed ?? "0"),
    totalNtlPos:       parseFloat(safeState?.marginSummary?.totalNtlPos     ?? "0"),
    withdrawable:      Math.max(parseFloat(safeState?.withdrawable ?? "0"), spotUsdcBalance),
  } : null;

  return {
    platform:      "Hyperliquid",
    chain:         "Hyperliquid L1",
    chainColor:    "#00FF79",
    positions,
    accountSummary,
    pnl: {
      realizedPnl,
      unrealizedPnl:  unrealizedTotal,
      totalFunding,
      totalFees,
      netLifetime:    realizedPnl + totalFunding - totalFees,
      pnlByMarket:    Object.entries(pnlByCoin).map(([coin, pnl]) => ({ coin, pnl }))
                        .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl)),
      fillCount:      safeFills.length,
      isExact:        !isTruncated,
      dataNote:       safeFills.length === 0
        ? "No trading history on Hyperliquid for this address."
        : isTruncated
        ? "Estimated — history truncated at ~10,000 fills."
        : `Exact — computed from all ${safeFills.length} fills.`,
    },
  };
}

// ─── Spot balances (Hyperliquid DEX) ─────────────────────────────────

export interface HyperliquidSpotBalance {
  coin:   string;
  total:  number;   // total balance
  avail:  number;   // available (not in active orders)
  price?: number;
  priceChange24h?: number;
  tokenId?: string;
  evmContract?: string | null;
  fullName?: string | null;
}

export interface HyperliquidSpotResult {
  balances: HyperliquidSpotBalance[];
  withdrawable: number; // USDC not locked in perp margin (rest balance)
  accountValue: number; // total perp equity from marginSummary
  totalMarginUsed: number; // total perp margin in use from marginSummary
  spotUsdc: number; // USDC reported by spotClearinghouseState
}

export async function fetchHyperliquidSpot(address: string): Promise<HyperliquidSpotResult | null> {
  try {
    let balancesData: HyperliquidSpotBalance[] = [];
    const spotMetaPromise = hlPost<
      [
        {
          tokens: Array<{
            name: string;
            tokenId?: string;
            evmContract?: string | null;
            fullName?: string | null;
            index: number;
          }>;
          universe: Array<{
            name: string;
            tokens: [number, number];
            index: number;
            isCanonical?: boolean;
          }>;
        },
        Array<{
          markPx?: string;
          midPx?: string;
          prevDayPx?: string;
        } | null>
      ]
    >({
      type: "spotMetaAndAssetCtxs",
    });
    const statePromise = hlPost<HLState>({
      type: "clearinghouseState",
      user: address,
    });

    // spotClearinghouseState — official endpoint for Hyperliquid spot/DEX balances
    const spotState = await hlPost<{ balances?: Array<{ coin: string; total: string; hold: string }> }>({
      type: "spotClearinghouseState",
      user: address,
    });

    console.info(`[hyperliquid] spotClearinghouseState raw result:`, JSON.stringify(spotState)?.slice(0, 300));

    const [spotMeta, state] = await Promise.all([spotMetaPromise, statePromise]);
    const tokenMarketMeta = new Map<string, {
      price?: number;
      priceChange24h?: number;
      tokenId?: string;
      evmContract?: string | null;
      fullName?: string | null;
    }>();

    if (spotMeta && Array.isArray(spotMeta[0]?.tokens) && Array.isArray(spotMeta[0]?.universe) && Array.isArray(spotMeta[1])) {
      const [meta, contexts] = spotMeta;
      const usdcTokenIndex = meta.tokens.find((token) => token.name?.toUpperCase() === "USDC")?.index ?? 0;

      for (let i = 0; i < meta.universe.length; i++) {
        const market = meta.universe[i];
        const ctx = contexts[i];
        if (!market || !ctx || !Array.isArray(market.tokens) || market.tokens.length !== 2) continue;

        const [baseIndex, quoteIndex] = market.tokens;
        if (quoteIndex !== usdcTokenIndex) continue;

        const baseToken = meta.tokens.find((token) => token.index === baseIndex);
        if (!baseToken?.name) continue;

        const currentPx = parseFloat(ctx.midPx ?? ctx.markPx ?? "0");
        const prevDayPx = parseFloat(ctx.prevDayPx ?? "0");
        const priceChange24h = currentPx > 0 && prevDayPx > 0
          ? ((currentPx / prevDayPx) - 1) * 100
          : undefined;

        tokenMarketMeta.set(baseToken.name.toUpperCase(), {
          price: currentPx > 0 ? currentPx : undefined,
          priceChange24h,
          tokenId: baseToken.tokenId,
          evmContract: typeof baseToken.evmContract === "string" ? baseToken.evmContract : null,
          fullName: typeof baseToken.fullName === "string" ? baseToken.fullName : null,
        });
      }
    }

    if (spotState?.balances && spotState.balances.length > 0) {
      balancesData = spotState.balances
        .map((b) => {
          const meta = tokenMarketMeta.get(b.coin.toUpperCase());
          return {
            coin:  b.coin,
            total: parseFloat(b.total),
            avail: Math.max(0, parseFloat(b.total) - parseFloat(b.hold)),
            price: meta?.price,
            priceChange24h: meta?.priceChange24h,
            tokenId: meta?.tokenId,
            evmContract: meta?.evmContract,
            fullName: meta?.fullName,
          };
        })
        .filter((b) => b.total > 0);
      console.info(`[hyperliquid] spotClearinghouseState parsed ${balancesData.length} tokens`);
    }

    // clearinghouseState for total perp equity + withdrawable balance.
    const spotUsdc = balancesData
      .filter((balance) => balance.coin.toUpperCase() === "USDC")
      .reduce((sum, balance) => sum + balance.total, 0);
    const withdrawable = Math.max(parseFloat(state?.withdrawable ?? "0"), spotUsdc);
    const accountValue = parseFloat(state?.marginSummary?.accountValue ?? "0");
    const totalMarginUsed = parseFloat(state?.marginSummary?.totalMarginUsed ?? "0");
    console.info(
      `[hyperliquid] final: ${balancesData.length} spot tokens, withdrawable USDC: $${withdrawable}, perp equity: $${accountValue}, margin used: $${totalMarginUsed}`
    );

    return { balances: balancesData, withdrawable, accountValue, totalMarginUsed, spotUsdc };
  } catch (err) {
    console.warn("[hyperliquid] spot balance fetch failed:", err);
    return null;
  }
}
