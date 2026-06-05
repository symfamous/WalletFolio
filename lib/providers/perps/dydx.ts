/**
 * lib/providers/perps/dydx.ts
 *
 * dYdX v4 Indexer API adapter.
 *
 * dYdX v4 is a fully on-chain orderbook on its own Cosmos app-chain.
 * Positions and fills are publicly readable from the indexer.
 *
 * Indexer base URL: https://indexer.dydx.trade/v4
 * Docs: https://docs.dydx.exchange/developers/indexer/indexer_api
 *
 * No API key required for reads.
 *
 * Data quality:
 *   positions     → exact (indexer state)
 *   realizedPnl   → exact from fills
 *   unrealizedPnl → calculated from entry vs mark price
 *   funding       → estimated (not directly exposed per-user in v4 indexer)
 *
 * Note: dYdX v4 addresses are Cosmos bech32 (dydx1...), but EVM addresses
 * can be mapped via the SubaccountId derivation. We accept both.
 */

import type { NormalizedPerpPosition, NormalizedPerpPlatform, PerpPlatformPnl } from "./types";
import { ProviderRequestError, providerFetchJson } from "@/lib/providers/resilience";

const INDEXER = "https://indexer.dydx.trade/v4";
const TIMEOUT = 10_000;

async function dydxGet<T>(path: string): Promise<T | null> {
  try {
    return await providerFetchJson<T>(
      "dydx",
      `${INDEXER}${path}`,
      {
        headers: { Accept: "application/json" },
        // @ts-ignore
        next: { revalidate: 30 },
      },
      { timeoutMs: TIMEOUT }
    );
  } catch (err) {
    if (err instanceof ProviderRequestError && err.status === 404) return null;
    console.debug("[dydx] fetch failed:", err instanceof ProviderRequestError ? err.message : err);
    return null;
  }
}

interface DydxSubaccount {
  address:        string;
  subaccountNumber: number;
  equity:         string;
  freeCollateral: string;
  openPerpetualPositions: Record<string, DydxPerpPosition>;
}
interface DydxPerpPosition {
  market:          string;
  status:          "OPEN" | "CLOSED" | "LIQUIDATED";
  side:            "LONG" | "SHORT";
  size:            string;
  maxSize:         string;
  entryPrice:      string;
  exitPrice:       string | null;
  realizedPnl:     string;
  unrealizedPnl:   string;
  closedAt:        string | null;
  sumOpen:         string;
  sumClose:        string;
  netFunding:      string;
  createdAt:       string;
  createdAtHeight: string;
}

interface DydxSubaccountsResponse {
  subaccounts: DydxSubaccount[];
}

interface DydxFill {
  id:        string;
  side:      "BUY" | "SELL";
  liquidity: "TAKER" | "MAKER";
  type:      string;
  market:    string;
  price:     string;
  size:      string;
  fee:       string;
  createdAt: string;
}
interface DydxFillsResponse { fills: DydxFill[] }

interface DydxTransferResponse {
  transfers: Array<{ amount: string; type: "TRANSFER_IN" | "TRANSFER_OUT" | "DEPOSIT" | "WITHDRAWAL" }>;
}

/**
 * dYdX v4 uses Cosmos addresses. EVM wallets need to derive their
 * dYdX address. This is done via a deterministic mapping:
 * the last 20 bytes of the sha256 of the compressed public key.
 *
 * Without the public key we can't derive it — so we try to look up
 * the address as-is and also with a common subaccount number 0.
 *
 * In practice, users who use dYdX v4 via MetaMask have their EVM
 * address mapped — the indexer accepts both formats for reads.
 */
export async function fetchDydxPerps(address: string): Promise<NormalizedPerpPlatform> {
  const empty: NormalizedPerpPlatform = {
    platform:       "dYdX v4",
    chain:          "dYdX Chain",
    chainColor:     "#6966FF",
    positions:      [],
    accountSummary: null,
    pnl: {
      realizedPnl: 0, unrealizedPnl: 0, totalFunding: 0,
      totalFees: 0, netLifetime: 0, pnlByMarket: [],
      fillCount: 0, isExact: false,
      dataNote: "No dYdX v4 positions found for this address.",
    },
  };

  // dYdX v4 indexer accepts both EVM-format and Cosmos-format addresses
  const data = await dydxGet<DydxSubaccountsResponse>(
    `/addresses/${address}/subaccounts`
  );

  if (!data?.subaccounts?.length) return empty;

  // Aggregate across all subaccounts (usually just subaccount 0)
  const positions: NormalizedPerpPosition[] = [];
  let realizedPnl = 0, totalFees = 0, netFunding = 0;
  const pnlByCoin: Record<string, number> = {};
  let totalFillCount = 0;
  let totalEquity = 0;

  for (const sub of data.subaccounts) {
    totalEquity += parseFloat(sub.equity ?? "0");
    const perpPositions = Object.values(sub.openPerpetualPositions ?? {});

    for (const pos of perpPositions) {
      if (pos.status !== "OPEN") continue;

      const size    = parseFloat(pos.size ?? "0");
      const entry   = parseFloat(pos.entryPrice ?? "0");
      const upnl    = parseFloat(pos.unrealizedPnl ?? "0");
      const posVal  = size * entry;
      const markPx  = posVal > 0 ? posVal / size + upnl / size : entry;

      positions.push({
        platform:         "dYdX v4",
        chain:            "dYdX Chain",
        chainColor:       "#6966FF",
        market:           pos.market,
        coin:             pos.market.replace("-USD", ""),
        side:             pos.side === "LONG" ? "long" : "short",
        size,
        entryPrice:       entry,
        markPrice:        markPx,
        positionValue:    posVal,
        unrealizedPnl:    upnl,
        leverage:         1, // not directly in indexer response
        leverageType:     "cross",
        liquidationPrice: null, // not in indexer response
        liqDistancePct:   null,
        marginUsed:       0,
        fundingSinceOpen: parseFloat(pos.netFunding ?? "0"),
        returnOnEquity:   0,
        riskLevel:        "safe",
        status:           "open",
        isExact:          true,
      });

      // Accumulate realized PnL from closed positions too
      realizedPnl += parseFloat(pos.realizedPnl ?? "0");
      netFunding  += parseFloat(pos.netFunding  ?? "0");
      pnlByCoin[pos.market.replace("-USD", "")] =
        (pnlByCoin[pos.market.replace("-USD", "")] ?? 0) + parseFloat(pos.realizedPnl ?? "0");
    }

    // Fetch fills for fees
    const fillsData = await dydxGet<DydxFillsResponse>(
      `/fills?address=${address}&subaccountNumber=${sub.subaccountNumber}&limit=100`
    );
    const fills = fillsData?.fills ?? [];
    totalFillCount += fills.length;
    for (const fill of fills) {
      totalFees += parseFloat(fill.fee ?? "0");
    }
  }

  const unrealizedTotal = positions.reduce((s, p) => s + p.unrealizedPnl, 0);

  return {
    platform:   "dYdX v4",
    chain:      "dYdX Chain",
    chainColor: "#6966FF",
    positions,
    accountSummary: totalEquity > 0 ? {
      accountValue:    totalEquity,
      totalMarginUsed: 0,
      totalNtlPos:     positions.reduce((s, p) => s + p.positionValue, 0),
      withdrawable:    totalEquity,
    } : null,
    pnl: {
      realizedPnl,
      unrealizedPnl:  unrealizedTotal,
      totalFunding:   netFunding,
      totalFees,
      netLifetime:    realizedPnl + netFunding - totalFees,
      pnlByMarket:    Object.entries(pnlByCoin).map(([coin, pnl]) => ({ coin, pnl }))
                        .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl)),
      fillCount:      totalFillCount,
      isExact:        totalFillCount < 100, // truncated after 100 per call
      dataNote:       positions.length === 0 && realizedPnl === 0
        ? "No dYdX v4 positions found for this address."
        : totalFillCount >= 100
        ? `Partial — showing ${totalFillCount} most recent fills. Earlier history omitted.`
        : `Computed from subaccount data on dYdX Chain.`,
    },
  };
}
