/**
 * app/api/portfolio/[address]/route.ts
 *
 * Portfolio endpoint — Zerion-first portfolio data with best-effort Hyperliquid enrichment.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchZerionPositions } from "@/lib/providers/zerion";
import { fetchZapperTokens } from "@/lib/providers/zapper";
import { fetchMoralisTokens } from "@/lib/providers/moralis";
import { fetchCovalentDefiPositions } from "@/lib/providers/covalent";
import { fetchHyperliquidSpot } from "@/lib/providers/perps/hyperliquid";
import { normalizeZerionPositions } from "@/lib/normalize/positions";
import { normalizeZapperTokens } from "@/lib/normalize/zapper";
import { normalizeMoralisTokens } from "@/lib/normalize/moralis";
import { normalizeCovalentData } from "@/lib/normalize/covalent";
import { normalizeHyperliquidPerpEquity, normalizeHyperliquidSpot } from "@/lib/normalize/hyperliquid";
import { buildProtocolPositions } from "@/lib/normalize/protocols";
import { buildPortfolio } from "@/lib/aggregate/portfolio";
import { buildPortfolioIntelligence } from "@/lib/intelligence";
import { loadChainRegistry } from "@/lib/chains/registry";
import { enrichPositionsWithLivePrices } from "@/lib/prices/live";
import { isValidAddress, isSolanaAddress } from "@/lib/utils";
import {
  ProviderRequestError,
  isProviderEnabled,
} from "@/lib/providers/resilience";
import type { PortfolioApiResponse, NormalizedPosition } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function classifyRouteStatus(
  error: unknown
): "error" | "skipped" {
  if (error instanceof ProviderRequestError && (error.reason === "disabled" || error.reason === "circuit_open")) {
    return "skipped";
  }
  return "error";
}

function describeProviderError(provider: string, error: unknown): string {
  if (error instanceof ProviderRequestError) {
    if (error.reason === "disabled") {
      return `[${provider}] disabled, skipped`;
    }
    if (error.reason === "circuit_open") {
      return `[${provider}] circuit open, skipped`;
    }
    if (error.reason === "timeout") {
      return `[${provider}] timeout after ${error.timeoutMs ?? 0} ms`;
    }
    if (error.reason === "rate_limit") {
      return `[${provider}] rate limited`;
    }
    return error.message;
  }
  return `[${provider}] ${error instanceof Error ? error.message : String(error)}`;
}

function buildStablePortfolioResponse(
  address: string,
  providerStatus: PortfolioApiResponse["providerStatus"],
  hyperliquidSpot?: PortfolioApiResponse["hyperliquidSpot"]
): PortfolioApiResponse {
  const portfolio = buildPortfolio(address, [], []);
  const intelligence = buildPortfolioIntelligence(portfolio, null);

  return {
    portfolio,
    intelligence,
    hyperliquidSpot,
    providerStatus,
    timestamp: new Date().toISOString(),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const ZERION_API_KEY = process.env.ZERION_API_KEY ?? "";
  const ZAPPER_API_KEY = process.env.ZAPPER_API_KEY ?? "";
  const MORALIS_API_KEY = process.env.MORALIS_API_KEY ?? "";
  const COVALENT_API_KEY = process.env.COVALENT_API_KEY ?? "";

  const { address: raw } = await params;
  const address = raw.toLowerCase();

  if (!isValidAddress(address)) {
    if (isSolanaAddress(address)) {
      return NextResponse.json(
        { error: `Solana address detected — use /api/solana/${address}` },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Invalid EVM address" }, { status: 400 });
  }

  const zerionEnabled = isProviderEnabled("zerion");
  const zapperEnabled = isProviderEnabled("zapper");
  const moralisEnabled = isProviderEnabled("moralis");
  const covalentEnabled = isProviderEnabled("covalent");

  if (zerionEnabled && ZERION_API_KEY) {
    await loadChainRegistry(ZERION_API_KEY).catch(() => {});
  }

  // Fallback providers default to "skipped": they are only invoked when Zerion
  // yields zero positions. If they are never called, "skipped" is accurate —
  // they flip to "error" only when an actual request fails below.
  let zerionStatus: "ok" | "error" | "partial" | "skipped" = zerionEnabled && ZERION_API_KEY ? "error" : "skipped";
  let zapperStatus: "ok" | "error" | "skipped" = "skipped";
  let moralisStatus: "ok" | "error" | "skipped" = "skipped";
  let covalentStatus: "ok" | "error" | "skipped" = "skipped";
  let hyperliquidStatus: "ok" | "error" | "skipped" = "skipped";

  const [zerionResult, hyperliquidResult] = await Promise.allSettled([
    zerionEnabled && ZERION_API_KEY
      ? fetchZerionPositions(address, ZERION_API_KEY, 6, "no_filter")
      : Promise.resolve(null),
    fetchHyperliquidSpot(address),
  ]);

  let zerionPositions: ReturnType<typeof normalizeZerionPositions> = [];
  let zapperPositions: NormalizedPosition[] = [];
  let moralisPositions: NormalizedPosition[] = [];
  let covalentPositions: NormalizedPosition[] = [];
  let mainPortfolioPositions: NormalizedPosition[] = [];
  let mainPortfolioSource: "zerion" | "zapper" | "moralis" | "covalent" | "none" = "none";
  let fallbackReason: PortfolioApiResponse["providerStatus"]["fallbackReason"];
  let hyperliquidSpotData: PortfolioApiResponse["hyperliquidSpot"] = undefined;
  let hyperliquidPerpEquity: NormalizedPosition | null = null;
  let hyperliquidRaw: Awaited<ReturnType<typeof fetchHyperliquidSpot>> | null = null;

  if (zerionResult.status === "fulfilled" && zerionResult.value) {
    zerionPositions = normalizeZerionPositions(zerionResult.value);
    zerionStatus = zerionResult.value.length > 0 ? "ok" : "partial";
    console.info(`[portfolio] zerion usable positions=${zerionPositions.length}`);
  } else if (zerionResult.status === "rejected") {
    zerionStatus = classifyRouteStatus(zerionResult.reason) === "skipped" ? "skipped" : "error";
    console.warn(describeProviderError("zerion", zerionResult.reason));
    if (zerionResult.reason instanceof ProviderRequestError) {
      fallbackReason =
        zerionResult.reason.reason === "timeout" ||
        zerionResult.reason.reason === "rate_limit" ||
        zerionResult.reason.reason === "network" ||
        zerionResult.reason.reason === "server_error" ||
        zerionResult.reason.reason === "http_error" ||
        zerionResult.reason.reason === "disabled" ||
        zerionResult.reason.reason === "circuit_open"
          ? zerionResult.reason.reason
          : "unknown";
    } else {
      fallbackReason = "unknown";
    }
  }

  if (zerionPositions.length > 0) {
    mainPortfolioPositions = zerionPositions;
    mainPortfolioSource = "zerion";
    console.info(`[portfolio] selected main portfolio source=zerion positions=${zerionPositions.length}`);
  } else {
    console.info("[portfolio] zerion unavailable or unusable, invoking fallback portfolio providers");
    const [zapperResult, moralisResult, covalentResult] = await Promise.allSettled([
      zapperEnabled && ZAPPER_API_KEY ? fetchZapperTokens(address, ZAPPER_API_KEY) : Promise.resolve(null),
      moralisEnabled && MORALIS_API_KEY ? fetchMoralisTokens(address, MORALIS_API_KEY) : Promise.resolve([]),
      covalentEnabled && COVALENT_API_KEY ? fetchCovalentDefiPositions(address, COVALENT_API_KEY) : Promise.resolve(null),
    ]);

    if (zapperResult.status === "fulfilled" && zapperResult.value) {
      zapperPositions = normalizeZapperTokens(zapperResult.value).positions;
      zapperStatus = zapperPositions.length > 0 ? "ok" : "skipped";
      console.info(`[portfolio] zapper usable positions=${zapperPositions.length}`);
    } else if (zapperResult.status === "rejected") {
      zapperStatus = classifyRouteStatus(zapperResult.reason);
      console.warn(describeProviderError("zapper", zapperResult.reason));
    }

    if (moralisResult.status === "fulfilled" && moralisResult.value) {
      moralisPositions = normalizeMoralisTokens(moralisResult.value).positions;
      moralisStatus = moralisPositions.length > 0 ? "ok" : "skipped";
      console.info(`[portfolio] moralis usable positions=${moralisPositions.length}`);
    } else if (moralisResult.status === "rejected") {
      moralisStatus = classifyRouteStatus(moralisResult.reason);
      console.warn(describeProviderError("moralis", moralisResult.reason));
    }

    if (covalentResult.status === "fulfilled" && covalentResult.value) {
      covalentPositions = normalizeCovalentData(covalentResult.value).positions;
      covalentStatus = covalentPositions.length > 0 ? "ok" : "skipped";
      console.info(`[portfolio] covalent usable positions=${covalentPositions.length}`);
    } else if (covalentResult.status === "rejected") {
      covalentStatus = classifyRouteStatus(covalentResult.reason);
      console.warn(describeProviderError("covalent", covalentResult.reason));
    }

    if (zapperPositions.length > 0) {
      mainPortfolioPositions = zapperPositions;
      mainPortfolioSource = "zapper";
    } else if (moralisPositions.length > 0) {
      mainPortfolioPositions = moralisPositions;
      mainPortfolioSource = "moralis";
    } else if (covalentPositions.length > 0) {
      mainPortfolioPositions = covalentPositions;
      mainPortfolioSource = "covalent";
    }

    if (mainPortfolioSource !== "none") {
      console.info(
        `[portfolio] selected fallback portfolio source=${mainPortfolioSource} positions=${mainPortfolioPositions.length} reason=${fallbackReason ?? "unknown"}`
      );
    }
  }

  if (hyperliquidResult.status === "fulfilled" && hyperliquidResult.value) {
    hyperliquidRaw = hyperliquidResult.value;
    hyperliquidStatus = "ok";
  } else if (hyperliquidResult.status === "rejected") {
    hyperliquidStatus = classifyRouteStatus(hyperliquidResult.reason);
    console.warn(describeProviderError("hyperliquid", hyperliquidResult.reason));
  }

  const tokenPrices: Record<string, number> = {};
  for (const pos of mainPortfolioPositions) {
    if (pos.price !== undefined && pos.price > 0) {
      tokenPrices[pos.symbol.toUpperCase()] = pos.price;
    }
  }

  if (hyperliquidRaw) {
    const { positions: spotPositions } = normalizeHyperliquidSpot(hyperliquidRaw, tokenPrices);
    hyperliquidPerpEquity = normalizeHyperliquidPerpEquity(hyperliquidRaw);
    hyperliquidSpotData = {
      balances: spotPositions,
      withdrawable: hyperliquidRaw.withdrawable,
    };
    console.info(`[hyperliquid] spot ${spotPositions.length} tokens`);
  }

  const primaryFiltered = mainPortfolioPositions.filter((p) => {
    if (p.source !== "defi") return true;
    return p.usdValue === undefined || p.usdValue >= 5 || p.positionType === "borrow";
  });

  const hyperliquidSpotTokens = (hyperliquidSpotData?.balances ?? [])
    .filter((hl) => !primaryFiltered.some((p) => p.symbol === hl.symbol && p.chainSlug === hl.chainSlug));

  const seenIds = new Set<string>();
  const allPositionsRaw: NormalizedPosition[] = [
    ...primaryFiltered,
    ...(hyperliquidPerpEquity ? [hyperliquidPerpEquity] : []),
    ...hyperliquidSpotTokens,
  ].filter((p) => {
    if (seenIds.has(p.id)) return false;
    seenIds.add(p.id);
    return true;
  });

  const providerStatus: PortfolioApiResponse["providerStatus"] = {
    zerion: zerionStatus,
    hyperliquid: hyperliquidStatus,
    morpho: "skipped",
    covalent: covalentStatus,
    zapper: zapperStatus,
    moralis: moralisStatus,
    projectx: "skipped",
    fallbackUsed: mainPortfolioSource !== "none" && mainPortfolioSource !== "zerion",
    fallbackSource:
      mainPortfolioSource === "zapper" || mainPortfolioSource === "moralis" || mainPortfolioSource === "covalent"
        ? mainPortfolioSource
        : undefined,
    fallbackReason,
    fallbackCoverage:
      mainPortfolioSource === "zapper"
        ? "good"
        : mainPortfolioSource === "moralis" || mainPortfolioSource === "covalent"
          ? "partial"
          : undefined,
  };

  const hasZerionPortfolioData = primaryFiltered.length > 0;
  const hasHyperliquidOnlyData =
    mainPortfolioSource === "none" &&
    ((hyperliquidPerpEquity ? 1 : 0) + hyperliquidSpotTokens.length > 0);

  if (allPositionsRaw.length === 0) {
    console.info("[portfolio] no live provider data available, returning stable empty portfolio");
    return NextResponse.json(
      buildStablePortfolioResponse(address, providerStatus, hyperliquidSpotData),
      { headers: { "Cache-Control": "s-maxage=5, stale-while-revalidate=15" } }
    );
  }

  const allPositions = await enrichPositionsWithLivePrices(allPositionsRaw);
  const allProtocols = buildProtocolPositions(allPositions.filter((p) => p.source === "defi"));

  console.info(
    `[portfolio] partial response built from ${
      [
        mainPortfolioSource !== "none" ? mainPortfolioSource : null,
        hyperliquidSpotData ? "hyperliquid" : null,
      ].filter(Boolean).join(" + ") || "none"
    }`
  );

  if (hasHyperliquidOnlyData) {
    console.warn(
      `[portfolio] Hyperliquid-only response because no portfolio provider produced usable positions (zerion=${zerionStatus}, zapper=${zapperStatus}, moralis=${moralisStatus}, covalent=${covalentStatus})`
    );
  }

  if (process.env.NODE_ENV === "development") {
    console.info(
      `[portfolio] debug sources main=${mainPortfolioSource} zerion=${zerionStatus}/${zerionPositions.length} zapper=${zapperStatus}/${zapperPositions.length} moralis=${moralisStatus}/${moralisPositions.length} covalent=${covalentStatus}/${covalentPositions.length} hyperliquid=${hyperliquidStatus} hyperliquidSpot=${hyperliquidSpotTokens.length} hyperliquidPerp=${hyperliquidPerpEquity ? 1 : 0}`
    );
  }

  const portfolio = buildPortfolio(address, allPositions, allProtocols);
  const intelligence = buildPortfolioIntelligence(portfolio, null);

  const response: PortfolioApiResponse = {
    portfolio,
    intelligence,
    hyperliquidSpot: hyperliquidSpotData,
    providerStatus,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "s-maxage=5, stale-while-revalidate=15" },
  });
}
