/**
 * app/api/history/[address]/route.ts
 *
 * Wallet history endpoint — multi-provider pipeline.
 *
 * Strategy:
 *   1. Detect Solana vs EVM address
 *   2. Solana → free Helius RPC (getSignaturesForAddress + getTransaction) → normalizeSolanaHistory
 *   3. EVM → Run Zerion + Etherscan IN PARALLEL
 *   4. Zerion gives clean normalized events for all its supported chains
 *   5. Etherscan fills gaps with chain-by-chain txlist + tokentx
 *   6. Merge: Zerion events win on overlap, Etherscan adds unique chains
 *   7. Spam filter, dedup, sort newest-first
 *
 * Result: comprehensive chain coverage across Solana and EVM chains.
 */

import { NextRequest, NextResponse }    from "next/server";
import { normalizeEtherscanHistory }    from "@/lib/history/normalize";
import { normalizeSolanaHistory }       from "@/lib/history/solana";
import { normalizeZerionHistory }       from "@/lib/normalize/history";
import { mergeHistoryEvents, countChainsWithData } from "@/lib/history/merge";
import { fetchZerionTransactions }      from "@/lib/providers/history/zerion";
import { fetchAllChains, fetchChainHistory, HISTORY_CHAINS } from "@/lib/providers/history/etherscan";
import { fetchSolanaTransactions }     from "@/lib/providers/history/solana";
import { ETHERSCAN_CHAINS }             from "@/lib/providers/etherscan";
import { loadChainRegistry }            from "@/lib/chains/registry";
import { isValidAddress, isSolanaAddress }               from "@/lib/utils";
import { ProviderRequestError, isProviderEnabled } from "@/lib/providers/resilience";
import type { HistoryApiResponse, HistoryEvent } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function logHistoryProviderFailure(provider: string, error: unknown) {
  if (error instanceof ProviderRequestError) {
    if (error.reason === "circuit_open") {
      console.warn(`[history/${provider}] circuit open, skipped`);
      return;
    }
    if (error.reason === "disabled") {
      console.info(`[history/${provider}] disabled, skipped`);
      return;
    }
    if (error.reason === "timeout") {
      console.warn(`[history/${provider}] timeout after ${error.timeoutMs ?? 0} ms`);
      return;
    }
    if (error.reason === "rate_limit") {
      console.warn(`[history/${provider}] rate limited`);
      return;
    }
  }
  console.warn(`[history/${provider}] failed:`, error);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY ?? "";
  const ZERION_API_KEY = process.env.ZERION_API_KEY ?? "";
  const HELIUS_API_KEY = process.env.HELIUS_API_KEY ?? "";

  const { address: raw } = await params;
  // Preserve case for Solana (base58 is case-sensitive), lowercase for EVM
  const isSolana = isSolanaAddress(raw.trim()) && !raw.startsWith("0x");
  const address  = isSolana ? raw.trim() : raw.toLowerCase();

  if (!isValidAddress(address) && !isSolanaAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  // Solana history via free Helius RPC
  if (isSolana) {
    if (!HELIUS_API_KEY) {
      return NextResponse.json({
        events: [], hasMore: false, page: 1, provider: "helius",
        chainsQueried: 0, chainsWithData: 0, chainsAvailable: 0,
        providerLabel: "Solana - HELIUS_API_KEY not configured",
        zerionEventCount: 0, escanEventCount: 0, totalMerged: 0,
      }, { headers: { "Cache-Control": "s-maxage=60" } });
    }

    const solUrl     = new URL(req.url);
    const cursor     = solUrl.searchParams.get("cursor") ?? undefined;
    const limitParam = solUrl.searchParams.get("limit") ?? "50";
    const limit = Math.min(100, parseInt(limitParam, 10));

    try {
      const { transactions, cursor: nextCursor } = await fetchSolanaTransactions(
        address,
        HELIUS_API_KEY,
        cursor,
        limit,
      );

      console.info(`[history:solana] Got ${transactions.length} txs from Helius RPC, cursor=${nextCursor ?? "none"}`);

      // Log first tx to see structure
      if (transactions.length > 0) {
        const first = transactions[0];
        console.info(`[history:solana] First tx: sig=${first.signature?.slice(0, 8)}, slot=${first.slot}, blockTime=${first.blockTime}, meta=${JSON.stringify(first.meta)?.slice(0, 100)}`);
      }

      const events = normalizeSolanaHistory(transactions, address);

      return NextResponse.json({
        events,
        hasMore:    !!nextCursor,
        cursor:     nextCursor,
        page:       1,
        provider:   "helius",
        chainsQueried:  1,
        chainsWithData: events.length > 0 ? 1 : 0,
        chainsAvailable: 1,
        providerLabel:  "Helius RPC",
        zerionEventCount: events.length,
        escanEventCount:  0,
        totalMerged:      events.length,
      } as HistoryApiResponse, {
        headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" },
      });
    } catch (err) {
      console.error("[history:solana] Helius fetch failed:", err);
      return NextResponse.json({
        events: [], hasMore: false, page: 1, provider: "helius",
        chainsQueried: 0, chainsWithData: 0, chainsAvailable: 0,
        providerLabel: "Solana history unavailable",
        zerionEventCount: 0, escanEventCount: 0, totalMerged: 0,
      }, { headers: { "Cache-Control": "s-maxage=30" } });
    }
  }

  const zerionEnabled = isProviderEnabled("zerion_history") && Boolean(ZERION_API_KEY);

  if (!ETHERSCAN_API_KEY && !zerionEnabled) {
    return NextResponse.json({ error: "No API keys configured" }, { status: 503 });
  }

  const url       = new URL(req.url);
  const chainSlug = url.searchParams.get("chain")  ?? undefined;
  const pageParam = url.searchParams.get("page")   ?? "1";
  const cursor    = url.searchParams.get("cursor") ?? undefined;
  const page      = Math.max(1, parseInt(pageParam, 10));

  if (zerionEnabled) await loadChainRegistry(ZERION_API_KEY).catch(() => {});

  // ── Run both providers in parallel ────────────────────────────
  const [zerionResult, etherscanResult] = await Promise.allSettled([
    // Zerion — primary, normalized
    zerionEnabled
      ? fetchZerionTransactions(address, ZERION_API_KEY, cursor, 100)
      : Promise.resolve(null),

    // Etherscan — coverage filler
    ETHERSCAN_API_KEY
      ? (chainSlug && chainSlug !== "all"
          ? fetchSingleChain(address, chainSlug, ETHERSCAN_API_KEY, page)
          : fetchAllChains(address, ETHERSCAN_API_KEY, page))
      : Promise.resolve(null),
  ]);

  // ── Normalize Zerion events ────────────────────────────────────
  let zerionEvents:    HistoryEvent[] = [];
  let zerionCursor:    string | undefined;
  let zerionHasMore    = false;

  if (zerionResult.status === "fulfilled" && zerionResult.value) {
    const page = zerionResult.value;
    zerionEvents   = normalizeZerionHistory(page.data);
    zerionCursor   = page.next;
    zerionHasMore  = Boolean(page.next);
  } else if (zerionResult.status === "rejected") {
    logHistoryProviderFailure("zerion", zerionResult.reason);
  }

  // ── Normalize Etherscan events ─────────────────────────────────
  let etherscanEvents:  HistoryEvent[] = [];
  let chainsQueried     = 0;
  let chainsWithDataEs  = 0;
  let freeTierLimited   = false;
  let escanHasMore      = false;

  if (etherscanResult.status === "fulfilled" && etherscanResult.value) {
    const results = etherscanResult.value as Awaited<ReturnType<typeof fetchAllChains>>;
    chainsQueried = results.length;

    for (const r of results) {
      if (r.status === "success") {
        chainsWithDataEs++;
        etherscanEvents.push(...normalizeEtherscanHistory(
          r.txs, r.tokenTxs, address,
          r.chain.slug, r.chain.name, r.chain.color, r.chain.emoji, r.chain.explorer,
        ));
        if (r.txs.length >= 100 || r.tokenTxs.length >= 100) escanHasMore = true;
      }
      if (r.status === "plan") freeTierLimited = true;
    }
  } else if (etherscanResult.status === "rejected") {
    logHistoryProviderFailure("etherscan", etherscanResult.reason);
  }

  // ── Merge: Zerion wins on overlap, Etherscan fills gaps ────────
  const merged  = mergeHistoryEvents(zerionEvents, etherscanEvents);
  const hasMore = zerionHasMore || escanHasMore;

  // Coverage summary
  const chainsWithData = countChainsWithData(merged);
  const providers: string[] = [];
  if (zerionEvents.length > 0)    providers.push("Zerion");
  if (etherscanEvents.length > 0) providers.push("Etherscan");
  const providerStr = providers.join(" + ") || "none";

  let freeTierNote: string | undefined;
  if (freeTierLimited) {
    freeTierNote = "Some chains require a paid Etherscan plan.";
  }

  const response: HistoryApiResponse = {
    events:   merged,
    hasMore,
    cursor:   zerionCursor,
    page,
    nextPage: hasMore && !zerionCursor ? page + 1 : undefined,
    provider: providers.includes("Zerion") && providers.includes("Etherscan")
      ? "zerion"  // use "zerion" union value to indicate both
      : providers.includes("Etherscan") ? "etherscan" : "zerion",
    chainsQueried,
    chainsWithData,
    chainsAvailable: HISTORY_CHAINS.length,
    freeTierNote,
    // Extended metadata for UI
    providerLabel:     providerStr,
    zerionEventCount:  zerionEvents.length,
    escanEventCount:   etherscanEvents.length,
    totalMerged:       merged.length,
  } as HistoryApiResponse;

  return NextResponse.json(response, {
    headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
  });
}

// ── Helpers ────────────────────────────────────────────────────────

async function fetchSingleChain(
  address:  string,
  chainSlug: string,
  apiKey:   string,
  page:     number,
) {
  const chain = HISTORY_CHAINS.find((c) => c.slug === chainSlug)
    ?? ETHERSCAN_CHAINS.find((c) => c.slug === chainSlug);
  if (!chain) return [];
  const result = await fetchChainHistory(address, chain as any, apiKey, page);
  return [result];
}
