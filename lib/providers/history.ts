/**
 * lib/providers/history.ts
 *
 * Fetches wallet transaction history from Zerion's /transactions/ endpoint.
 *
 * This endpoint returns normalized, categorized transactions with:
 * - operation_type: human-friendly category (trade, send, receive, deposit, etc.)
 * - transfers: list of tokens moved
 * - fee: gas cost
 * - chain: which chain
 *
 * Available on Zerion free tier. Returns up to 100 transactions per page.
 *
 * Coverage: same chains as portfolio (Zerion's supported chains).
 * HyperEVM is not yet supported by Zerion history.
 */

import type { ZerionTransaction } from "@/types";

const BASE_URL = "https://api.zerion.io/v1";

function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

export interface ZerionHistoryPage {
  data:    ZerionTransaction[];
  next?:   string;  // cursor
}

export async function fetchZerionHistory(
  address:  string,
  apiKey:   string,
  cursor?:  string,
  pageSize  = 50
): Promise<ZerionHistoryPage> {
  const params = new URLSearchParams({
    "currency":    "usd",
    "page[size]":  String(pageSize),
  });

  if (cursor) params.set("page[after]", cursor);

  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 15_000);

  try {
    const res = await fetch(
      `${BASE_URL}/wallets/${address}/transactions/?${params}`,
      {
        headers: {
          Authorization: authHeader(apiKey),
          Accept:        "application/json",
        },
        signal: ctrl.signal,
        next:   { revalidate: 60 },
      }
    );

    if (!res.ok) {
      console.warn(`[history] Zerion transactions HTTP ${res.status}`);
      return { data: [] };
    }

    const body: {
      data:  ZerionTransaction[];
      links: { next?: string };
    } = await res.json();

    let nextCursor: string | undefined;
    if (body.links?.next) {
      const u = new URL(body.links.next);
      nextCursor = u.searchParams.get("page[after]") ?? undefined;
    }

    return { data: body.data ?? [], next: nextCursor };
  } catch (err) {
    console.warn("[history] fetchZerionHistory failed:", err);
    return { data: [] };
  } finally {
    clearTimeout(tid);
  }
}
