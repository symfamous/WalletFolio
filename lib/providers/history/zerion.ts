/**
 * lib/providers/history/zerion.ts
 *
 * Fetches wallet transaction history from Zerion's v1 /transactions/ endpoint.
 *
 * Returns normalized, categorized transactions with:
 * - operation_type: human-friendly category
 * - transfers: token movements
 * - fee: gas cost
 * - chain: which chain
 *
 * Free tier: up to 100 tx/page, cursor-based pagination.
 * Coverage: all Zerion-supported chains (30+ EVM networks).
 */

import type { ZerionTransaction } from "@/types";
import { providerFetch } from "@/lib/providers/resilience";

const BASE_URL = "https://api.zerion.io/v1";

function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

export interface ZerionHistoryPage {
  data:    ZerionTransaction[];
  next?:   string;
  total?:  number;
}

export async function fetchZerionTransactions(
  address:  string,
  apiKey:   string,
  cursor?:  string,
  pageSize  = 100,
): Promise<ZerionHistoryPage> {
  const params = new URLSearchParams({
    "currency":   "usd",
    "page[size]": String(Math.min(pageSize, 100)),
  });

  if (cursor) params.set("page[after]", cursor);

  const res = await providerFetch(
    "zerion_history",
    `${BASE_URL}/wallets/${address}/transactions/?${params}`,
    {
      headers: {
        Authorization: authHeader(apiKey),
        Accept: "application/json",
      },
      // @ts-ignore — Next.js extends RequestInit
      next: { revalidate: 60 },
    }
  );

  const json = await res.json();

  // Zerion returns { data: [], links: { next?: "cursor..." } }
  const data: ZerionTransaction[] = Array.isArray(json?.data) ? json.data : [];
  const next: string | undefined  = json?.links?.next
    ? new URL(json.links.next).searchParams.get("page[after]") ?? undefined
    : undefined;

  return { data, next, total: json?.meta?.total ?? data.length };
}
