import type { PerpDiscoveryCandidate, PerpDiscoveryMetrics } from "./types";

const PARADEX_API_BASE_URL = process.env.PARADEX_API_BASE_URL ?? "https://api.prod.paradex.trade";
const PARADEX_READONLY_TOKEN = process.env.PARADEX_READONLY_TOKEN ?? "";
const PARADEX_EVM_ADDRESS = (process.env.PARADEX_EVM_ADDRESS ?? "").toLowerCase();

const PARADEX_PAGE_SIZE = 1000;
const PARADEX_MAX_PAGES = 20;

interface ParadexCursorListResponse<T> {
  results?: T[] | null;
  next?: string | null;
  prev?: string | null;
}

interface ParadexAccountSummary {
  account?: string | null;
  account_value?: string | null;
  free_collateral?: string | null;
  initial_margin_requirement?: string | null;
  maintenance_margin_requirement?: string | null;
  margin_cushion?: string | null;
  settlement_asset?: string | null;
  status?: string | null;
  total_collateral?: string | null;
  updated_at?: number | null;
}

interface ParadexBalanceRow {
  token?: string;
  size?: string;
  last_updated_at?: number;
}

interface ParadexPositionRow {
  account?: string;
  average_entry_price?: string;
  average_entry_price_usd?: string;
  average_exit_price?: string;
  cached_funding_index?: string;
  closed_at?: number;
  cost?: string;
  cost_usd?: string;
  created_at?: number;
  id?: string;
  last_fill_id?: string;
  last_updated_at?: number;
  leverage?: string;
  liquidation_price?: string;
  market?: string;
  realized_positional_funding_pnl?: string;
  realized_positional_pnl?: string;
  seq_no?: number;
  side?: string;
  size?: string;
  status?: string;
  unrealized_funding_pnl?: string;
  unrealized_pnl?: string;
}

interface ParadexFillRow {
  account?: string;
  client_id?: string;
  created_at?: number;
  fee?: string;
  fee_currency?: string;
  fill_type?: string;
  flags?: string[];
  id?: string;
  liquidity?: string;
  market?: string;
  order_id?: string;
  orderbook_seq_no?: number;
  price?: string;
  realized_funding?: string;
  realized_pnl?: string;
  remaining_size?: string;
  side?: string;
  size?: string;
  underlying_price?: string;
}

interface ParadexOrderRow {
  account?: string;
  avg_fill_price?: string;
  cancel_reason?: string;
  client_id?: string;
  created_at?: number;
  flags?: string[];
  id?: string;
  instruction?: string;
  last_updated_at?: number;
  market?: string;
  price?: string;
  published_at?: number;
  received_at?: number;
  remaining_size?: string;
  request_info?: {
    id?: string;
    message?: string;
    request_type?: string;
    status?: string;
  };
  seq_no?: number;
  side?: string;
  size?: string;
  status?: string;
  stp?: string;
  timestamp?: number;
  trigger_price?: string;
  type?: string;
}

type ParadexFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; status?: number; error: string };

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toIsoTimestamp(value: unknown): string | undefined {
  const numeric = toNumber(value);
  if (!numeric || numeric <= 0) return undefined;

  const millis = numeric > 1e12 ? numeric : numeric * 1000;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

async function fetchParadexJson<T>(
  path: string,
  params?: Record<string, string>,
): Promise<ParadexFetchResult<T>> {
  try {
    const url = new URL(path, PARADEX_API_BASE_URL);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${PARADEX_READONLY_TOKEN}`,
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      const body = await res.text();
      return {
        ok: false,
        status: res.status,
        error: `Paradex ${path} returned HTTP ${res.status}${body ? `: ${body.slice(0, 160)}` : ""}`,
      };
    }

    return {
      ok: true,
      data: await res.json() as T,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : `Unknown Paradex ${path} error`,
    };
  }
}

async function fetchParadexCursorPages<T extends object>(
  path: string,
  baseParams?: Record<string, string>,
): Promise<ParadexFetchResult<T[]>> {
  const collected: T[] = [];
  let cursor: string | undefined;
  const seenCursors = new Set<string>();

  for (let page = 0; page < PARADEX_MAX_PAGES; page += 1) {
    const params: Record<string, string> = {
      ...(baseParams ?? {}),
      page_size: String(PARADEX_PAGE_SIZE),
    };

    if (cursor) {
      params.cursor = cursor;
    }

    const result = await fetchParadexJson<ParadexCursorListResponse<T>>(path, params);
    if (!result.ok) return result;

    const rows = Array.isArray(result.data.results) ? result.data.results : [];
    collected.push(...rows);

    const nextRef = result.data.next ?? "";
    const next = (() => {
      if (!nextRef) return "";
      try {
        const parsed = new URL(nextRef, PARADEX_API_BASE_URL);
        return parsed.searchParams.get("cursor") ?? nextRef;
      } catch {
        return nextRef;
      }
    })();

    if (!next || rows.length === 0 || seenCursors.has(next)) {
      break;
    }

    seenCursors.add(next);
    cursor = next;
  }

  return { ok: true, data: collected };
}

function sumNumeric<T>(rows: T[], select: (row: T) => unknown): number {
  return rows.reduce((total, row) => total + toNumber(select(row)), 0);
}

function sumFillNotional(rows: ParadexFillRow[]): number {
  return rows.reduce((total, row) => {
    const price = toNumber(row.price);
    const size = Math.abs(toNumber(row.size));
    return total + (price * size);
  }, 0);
}

export async function discoverParadexHistory(address: string): Promise<PerpDiscoveryCandidate | null> {
  if (!PARADEX_READONLY_TOKEN || !PARADEX_EVM_ADDRESS) return null;
  if (address.toLowerCase() !== PARADEX_EVM_ADDRESS) return null;

  const [accountRes, balancesRes, positionsRes, fillsRes, ordersRes] = await Promise.all([
    fetchParadexJson<ParadexAccountSummary>("/v1/account"),
    fetchParadexJson<ParadexCursorListResponse<ParadexBalanceRow>>("/v1/balance"),
    fetchParadexJson<ParadexCursorListResponse<ParadexPositionRow>>("/v1/positions"),
    fetchParadexCursorPages<ParadexFillRow>("/v1/fills"),
    fetchParadexCursorPages<ParadexOrderRow>("/v1/orders-history"),
  ]);

  const authFailure = [accountRes, balancesRes, positionsRes, fillsRes, ordersRes].find(
    (result) => !result.ok && (result.status === 401 || result.status === 403),
  );

  if (authFailure && !authFailure.ok) {
    return {
      protocolId: "paradex",
      protocolName: "Paradex",
      chain: "Ethereum / Paradex",
      addressKind: "evm",
      status: "unscanned",
      confidence: "low",
      evidence: [authFailure.error],
      notes: "Paradex readonly-token auth failed. Regenerate a valid readonly token in Paradex key management.",
    };
  }

  const scanErrors = [accountRes, balancesRes, positionsRes, fillsRes, ordersRes]
    .filter((result): result is Extract<typeof result, { ok: false }> => !result.ok)
    .map((result) => result.error);

  const account = accountRes.ok ? accountRes.data : null;
  const balances = balancesRes.ok && Array.isArray(balancesRes.data.results) ? balancesRes.data.results : [];
  const positions = positionsRes.ok && Array.isArray(positionsRes.data.results) ? positionsRes.data.results : [];
  const fills = fillsRes.ok ? fillsRes.data : [];
  const orders = ordersRes.ok ? ordersRes.data : [];

  const nonZeroBalances = balances.filter((row) => Math.abs(toNumber(row.size)) > 0);
  const openPositions = positions.filter((row) => (row.status ?? "").toUpperCase() === "OPEN" || Math.abs(toNumber(row.size)) > 0);

  const currentAccountValue = toNumber(account?.account_value);
  const realizedPnl = sumNumeric(fills, (row) => row.realized_pnl);
  const unrealizedPnl = sumNumeric(openPositions, (row) => row.unrealized_pnl);
  const totalFunding = sumNumeric(fills, (row) => row.realized_funding) +
    sumNumeric(openPositions, (row) => row.unrealized_funding_pnl);
  const totalFees = sumNumeric(fills, (row) => row.fee);
  const totalVolume = sumFillNotional(fills);
  const fillCount = fills.length;
  const openPositionCount = openPositions.length;
  const netLifetimePnl = realizedPnl + unrealizedPnl + totalFunding - totalFees;

  const detected = (
    currentAccountValue > 0 ||
    nonZeroBalances.length > 0 ||
    openPositionCount > 0 ||
    fillCount > 0 ||
    orders.length > 0
  );

  const timestamps = [
    toIsoTimestamp(account?.updated_at),
    ...balances.map((row) => toIsoTimestamp(row.last_updated_at)),
    ...positions.flatMap((row) => [toIsoTimestamp(row.created_at), toIsoTimestamp(row.last_updated_at), toIsoTimestamp(row.closed_at)]),
    ...fills.map((row) => toIsoTimestamp(row.created_at)),
    ...orders.flatMap((row) => [
      toIsoTimestamp(row.created_at),
      toIsoTimestamp(row.last_updated_at),
      toIsoTimestamp(row.published_at),
      toIsoTimestamp(row.received_at),
      toIsoTimestamp(row.timestamp),
    ]),
  ].filter((value): value is string => Boolean(value)).sort();

  if (!detected) {
    if (scanErrors.length > 0) {
      return {
        protocolId: "paradex",
        protocolName: "Paradex",
        chain: "Ethereum / Paradex",
        addressKind: "evm",
        status: "unscanned",
        confidence: "low",
        evidence: scanErrors,
        notes: "Paradex readonly-token scan completed only partially, so this wallet remains unscanned for now.",
      };
    }

    return {
      protocolId: "paradex",
      protocolName: "Paradex",
      chain: "Ethereum / Paradex",
      addressKind: "evm",
      status: "not_detected",
      confidence: "low",
      evidence: ["Authenticated Paradex readonly scan found no balances, positions, fills, or orders for this wallet."],
      notes: "Readonly-token support is wired with account, positions, fills, and orders history. Exact cashflow can build on top of these authenticated endpoints.",
    };
  }

  const evidence: string[] = ["Authenticated via Paradex readonly token"];
  if (currentAccountValue > 0) {
    evidence.push(`Current Paradex account value ${currentAccountValue.toFixed(2)}`);
  }
  if (nonZeroBalances.length > 0) {
    evidence.push(`${nonZeroBalances.length} non-zero Paradex balance row${nonZeroBalances.length === 1 ? "" : "s"} found`);
  }
  if (openPositionCount > 0) {
    evidence.push(`${openPositionCount} open Paradex position${openPositionCount === 1 ? "" : "s"} found`);
  }
  if (fillCount > 0) {
    evidence.push(`${fillCount} Paradex fill record${fillCount === 1 ? "" : "s"} loaded`);
  }
  if (orders.length > 0) {
    evidence.push(`${orders.length} Paradex order history record${orders.length === 1 ? "" : "s"} loaded`);
  }
  if (Math.abs(realizedPnl) > 0) {
    evidence.push(`Paradex realized PnL ${realizedPnl.toFixed(2)}`);
  }
  if (Math.abs(totalFees) > 0) {
    evidence.push(`Paradex fees tracked ${totalFees.toFixed(2)}`);
  }
  if (Math.abs(totalFunding) > 0) {
    evidence.push(`Paradex funding tracked ${totalFunding.toFixed(2)}`);
  }
  if (scanErrors.length > 0) {
    evidence.push(`Partial Paradex scan warnings: ${scanErrors.join(" | ")}`);
  }

  const metrics: PerpDiscoveryMetrics = {
    openPositionCount,
    currentAccountValue,
    realizedPnl,
    unrealizedPnl,
    netLifetimePnl,
    totalFees,
    totalFunding,
    totalVolume,
    fillCount,
  };

  return {
    protocolId: "paradex",
    protocolName: "Paradex",
    chain: "Ethereum / Paradex",
    addressKind: "evm",
    status: "detected",
    confidence: fillCount > 0 || openPositionCount > 0 ? "high" : "medium",
    evidence,
    notes: "Detected with a Paradex readonly token tied to this EVM wallet. Metrics are computed from current account state, open positions, full fills history, and order history.",
    metrics: Object.values(metrics).some((value) => value !== undefined && value !== 0) ? metrics : undefined,
    firstSeen: timestamps[0],
    lastSeen: timestamps.length > 0 ? timestamps[timestamps.length - 1] : undefined,
    interactionCount: fillCount + orders.length + openPositionCount || undefined,
  };
}
