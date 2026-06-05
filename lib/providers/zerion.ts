/**
 * lib/providers/zerion.ts
 *
 * Zerion API adapter — PRIMARY data provider.
 */

import type { ZerionPosition } from "@/types";
import {
  ProviderRequestError,
  providerFetch,
} from "@/lib/providers/resilience";

const BASE_URL = "https://api.zerion.io/v1";
const ZERION_REQUEST_TIMEOUT_MS = 8_000;
const ZERION_TOTAL_BUDGET_MS = 16_000;
const ZERION_CACHE_TTL_MS = 120_000;

/**
 * Minimal raw Zerion portfolio shape.
 * Expand later if you need more fields from the endpoint.
 */
export interface ZerionPortfolio {
  type?: string;
  id?: string;
  attributes?: Record<string, unknown>;
}

export interface ZerionDebugPageResult {
  ok: boolean;
  startedAt: string;
  durationMs: number;
  url: string;
  authConfigured: boolean;
  httpStatus?: number;
  providerReason?:
    | "timeout"
    | "network"
    | "rate_limit"
    | "server_error"
    | "http_error"
    | "disabled"
    | "circuit_open"
    | "unknown";
  finalReason?:
    | "success"
    | "timeout"
    | "network"
    | "rate_limit"
    | "auth"
    | "server_error"
    | "http_error"
    | "parser_mismatch"
    | "valid_empty"
    | "disabled"
    | "circuit_open"
    | "unknown";
  responseBodyPresent: boolean;
  responsePreview?: string;
  parsedCount: number;
  isEmptyAfterParse: boolean;
  nextCursor?: string;
  parseError?: string;
  message?: string;
}

interface ZerionPositionsCacheEntry {
  positions: ZerionPosition[];
  cachedAt: number;
  expiresAt: number;
}

function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

const zerionPositionsCache = new Map<string, ZerionPositionsCacheEntry>();
const zerionPositionsInflight = new Map<string, Promise<ZerionPosition[]>>();

function positionsCacheKey(
  address: string,
  maxPages: number,
  positionFilter: "only_complex" | "only_simple" | "no_filter"
): string {
  return `${address}:${maxPages}:${positionFilter}`;
}

function getCachedZerionPositions(cacheKey: string): ZerionPositionsCacheEntry | null {
  const cached = zerionPositionsCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    zerionPositionsCache.delete(cacheKey);
    return null;
  }
  return cached;
}

async function fetchPositionsPage(
  address: string,
  apiKey: string,
  cursor?: string,
  positionFilter: "only_complex" | "only_simple" | "no_filter" = "only_complex"
): Promise<{ data: ZerionPosition[]; next?: string }> {
  const params = new URLSearchParams({
    "filter[positions]": positionFilter,
    "filter[trash]": "only_non_trash",
    currency: "usd",
    sort: "value",
    "page[size]": "100",
  });

  if (cursor) {
    params.set("page[after]", cursor);
  }

  const url = `${BASE_URL}/wallets/${address}/positions/?${params.toString()}`;
  const startedAt = Date.now();
  const pageLabel = cursor ? `cursor:${cursor.slice(0, 12)}` : "page:1";
  console.info(`[zerion] positions request start ${pageLabel} ${url}`);

  let res: Response;
  try {
    res = await providerFetch(
      "zerion",
      url,
      {
        headers: {
          Authorization: authHeader(apiKey),
          Accept: "application/json",
        },
      },
      {
        timeoutMs: ZERION_REQUEST_TIMEOUT_MS,
        retries: { timeout: 1, network: 1, rate_limit: 1, server_error: 1 },
      }
    );
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    if (error instanceof ProviderRequestError) {
      console.warn(
        `[zerion] positions request failed ${pageLabel} after ${durationMs} ms (${error.reason})${error.status ? ` HTTP ${error.status}` : ""}: ${error.message}`
      );
    } else {
      console.warn(`[zerion] positions request failed ${pageLabel} after ${durationMs} ms:`, error);
    }
    throw error;
  }

  const durationMs = Date.now() - startedAt;
  console.info(`[zerion] positions response ${pageLabel} HTTP ${res.status} in ${durationMs} ms`);

  let body: {
    links?: { next?: string };
    data: ZerionPosition[];
  };
  try {
    body = await res.json();
  } catch (error) {
    console.warn(`[zerion] parse failure ${pageLabel} after ${durationMs} ms`, error);
    throw new Error("[zerion] parser mismatch for positions response");
  }

  if (!Array.isArray(body.data)) {
    console.warn(
      `[zerion] parser mismatch ${pageLabel}: expected data array, got keys [${Object.keys(body ?? {}).join(", ")}]`
    );
    throw new Error("[zerion] parser mismatch for positions payload");
  }

  let nextCursor: string | undefined;

  if (body.links?.next) {
    const nextUrl = new URL(body.links.next);
    nextCursor = nextUrl.searchParams.get("page[after]") ?? undefined;
  }

  console.info(
    `[zerion] positions parsed ${pageLabel}: count=${body.data.length}${nextCursor ? " next=yes" : " next=no"}`
  );

  return { data: body.data, next: nextCursor };
}

export async function debugZerionPositionsPage(
  address: string,
  apiKey: string,
  cursor?: string,
  positionFilter: "only_complex" | "only_simple" | "no_filter" = "no_filter"
): Promise<ZerionDebugPageResult> {
  const params = new URLSearchParams({
    "filter[positions]": positionFilter,
    "filter[trash]": "only_non_trash",
    currency: "usd",
    sort: "value",
    "page[size]": "100",
  });

  if (cursor) {
    params.set("page[after]", cursor);
  }

  const url = `${BASE_URL}/wallets/${address}/positions/?${params.toString()}`;
  const startedAt = Date.now();

  try {
    const res = await providerFetch(
      "zerion",
      url,
      {
        headers: {
          Authorization: authHeader(apiKey),
          Accept: "application/json",
        },
      },
      {
        timeoutMs: ZERION_REQUEST_TIMEOUT_MS,
        retries: { timeout: 1, network: 1, rate_limit: 1, server_error: 1 },
      }
    );

    const rawText = await res.text();
    const durationMs = Date.now() - startedAt;
    const responsePreview = rawText.slice(0, 240);
    let parsed: { links?: { next?: string }; data?: ZerionPosition[] };

    try {
      parsed = JSON.parse(rawText) as { links?: { next?: string }; data?: ZerionPosition[] };
    } catch (error) {
      return {
        ok: false,
        startedAt: new Date(startedAt).toISOString(),
        durationMs,
        url,
        authConfigured: Boolean(apiKey),
        httpStatus: res.status,
        finalReason: "parser_mismatch",
        responseBodyPresent: rawText.length > 0,
        responsePreview,
        parsedCount: 0,
        isEmptyAfterParse: true,
        parseError: error instanceof Error ? error.message : String(error),
        message: "[zerion] positions JSON parse failure",
      };
    }

    if (!Array.isArray(parsed.data)) {
      return {
        ok: false,
        startedAt: new Date(startedAt).toISOString(),
        durationMs,
        url,
        authConfigured: Boolean(apiKey),
        httpStatus: res.status,
        finalReason: "parser_mismatch",
        responseBodyPresent: rawText.length > 0,
        responsePreview,
        parsedCount: 0,
        isEmptyAfterParse: true,
        parseError: "Expected `data` array in Zerion response",
        message: "[zerion] positions payload shape mismatch",
      };
    }

    let nextCursor: string | undefined;
    if (parsed.links?.next) {
      const nextUrl = new URL(parsed.links.next);
      nextCursor = nextUrl.searchParams.get("page[after]") ?? undefined;
    }

    return {
      ok: true,
      startedAt: new Date(startedAt).toISOString(),
      durationMs,
      url,
      authConfigured: Boolean(apiKey),
      httpStatus: res.status,
      finalReason: parsed.data.length > 0 ? "success" : "valid_empty",
      responseBodyPresent: rawText.length > 0,
      responsePreview,
      parsedCount: parsed.data.length,
      isEmptyAfterParse: parsed.data.length === 0,
      nextCursor,
      message: parsed.data.length > 0 ? "[zerion] positions page parsed successfully" : "[zerion] positions page parsed but empty",
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    if (error instanceof ProviderRequestError) {
      const finalReason =
        error.reason === "http_error" && (error.status === 401 || error.status === 403)
          ? "auth"
          : error.reason;

      return {
        ok: false,
        startedAt: new Date(startedAt).toISOString(),
        durationMs,
        url,
        authConfigured: Boolean(apiKey),
        httpStatus: error.status,
        providerReason: error.reason,
        finalReason,
        responseBodyPresent: Boolean(error.message),
        responsePreview: error.message.slice(0, 240),
        parsedCount: 0,
        isEmptyAfterParse: true,
        message: error.message,
      };
    }

    return {
      ok: false,
      startedAt: new Date(startedAt).toISOString(),
      durationMs,
      url,
      authConfigured: Boolean(apiKey),
      providerReason: "unknown",
      finalReason: "unknown",
      responseBodyPresent: false,
      parsedCount: 0,
      isEmptyAfterParse: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function fetchZerionPositions(
  address: string,
  apiKey: string,
  maxPages = 10,
  positionFilter: "only_complex" | "only_simple" | "no_filter" = "only_complex",
  totalBudgetMs = ZERION_TOTAL_BUDGET_MS,
  fallbackApiKey?: string
): Promise<ZerionPosition[]> {
  const cacheKey = positionsCacheKey(address, maxPages, positionFilter);
  const inflight = zerionPositionsInflight.get(cacheKey);
  if (inflight) {
    console.info(`[zerion] reusing in-flight positions request for ${address}`);
    return inflight;
  }

  // Paginate through all positions using a single API key. Caches on success.
  const runWithKey = async (key: string, keyLabel: string): Promise<ZerionPosition[]> => {
    const all: ZerionPosition[] = [];
    let cursor: string | undefined;
    let page = 0;
    const startedAt = Date.now();

    do {
      if (Date.now() - startedAt >= totalBudgetMs) {
        console.warn(`[zerion] position budget ${totalBudgetMs} ms exhausted after ${page} pages; returning partial data`);
        break;
      }
      const { data, next } = await fetchPositionsPage(address, key, cursor, positionFilter);
      all.push(...data);
      cursor = next;
      page += 1;
    } while (cursor && page < maxPages);

    if (cursor && page >= maxPages) {
      console.warn(`[zerion] Position pagination capped at ${maxPages} pages for ${address}`);
    }

    const totalDurationMs = Date.now() - startedAt;
    console.info(`[zerion] positions complete for ${address} (${keyLabel} key): pages=${page} count=${all.length} duration=${totalDurationMs} ms`);
    if (all.length === 0) {
      console.warn(`[zerion] positions complete but empty for ${address} after ${totalDurationMs} ms`);
    } else {
      zerionPositionsCache.set(cacheKey, {
        positions: all,
        cachedAt: Date.now(),
        expiresAt: Date.now() + ZERION_CACHE_TTL_MS,
      });
    }

    return all;
  };

  const request = (async () => {
    try {
      return await runWithKey(apiKey, "primary");
    } catch (error) {
      if (error instanceof ProviderRequestError && error.reason === "rate_limit") {
        console.warn(
          `[zerion] positions rate limited for ${address}${error.retryAfterMs !== undefined ? ` (Retry-After ${error.retryAfterMs} ms)` : ""}`
        );

        // 1) A fresh cached copy is the cheapest recovery.
        const cached = getCachedZerionPositions(cacheKey);
        if (cached) {
          console.info(
            `[zerion] serving cached positions for ${address} (${cached.positions.length} items, age ${Date.now() - cached.cachedAt} ms)`
          );
          return cached.positions;
        }

        // 2) Otherwise fall back to the secondary Zerion key, if one is configured.
        if (fallbackApiKey && fallbackApiKey.trim() && fallbackApiKey !== apiKey) {
          console.warn(`[zerion] primary key rate limited; retrying ${address} with fallback key`);
          try {
            return await runWithKey(fallbackApiKey, "fallback");
          } catch (fallbackError) {
            if (fallbackError instanceof ProviderRequestError && fallbackError.reason === "rate_limit") {
              console.warn(`[zerion] fallback key also rate limited for ${address}`);
            } else {
              console.warn(`[zerion] fallback key request failed for ${address}:`, fallbackError);
            }
            throw fallbackError;
          }
        }

        console.warn(`[zerion] no cached positions and no usable fallback key for ${address} after rate limit`);
      }
      throw error;
    } finally {
      zerionPositionsInflight.delete(cacheKey);
    }
  })();

  zerionPositionsInflight.set(cacheKey, request);
  return request;
}

export async function fetchZerionPortfolio(
  address: string,
  apiKey: string
): Promise<ZerionPortfolio | null> {
  try {
    const res = await providerFetch(
      "zerion",
      `${BASE_URL}/wallets/${address}/portfolio/?currency=usd`,
      {
        headers: {
          Authorization: authHeader(apiKey),
          Accept: "application/json",
        },
      }
    );

    const body: { data: ZerionPortfolio } = await res.json();
    return body.data;
  } catch (err) {
    const message = err instanceof ProviderRequestError ? err.message : err;
    console.warn("[zerion] portfolio fetch failed:", message);
    return null;
  }
}
