import type { PerpDiscoveryCandidate, PerpDiscoveryMetrics } from "./types";

const EXTENDED_API_BASE_URL = process.env.EXTENDED_API_BASE_URL ?? "https://api.starknet.extended.exchange";
const EXTENDED_EVM_ADDRESS = (process.env.EXTENDED_EVM_ADDRESS ?? "").toLowerCase();
const EXTENDED_API_KEY = process.env.EXTENDED_API_KEY ?? "";
const EXTENDED_PUBLIC_KEY = process.env.EXTENDED_PUBLIC_KEY ?? "";
const EXTENDED_PRIVATE_KEY = process.env.EXTENDED_PRIVATE_KEY ?? "";
const EXTENDED_VAULT = process.env.EXTENDED_VAULT ?? "";
const EXTENDED_CLIENT_ID = process.env.EXTENDED_CLIENT_ID ?? "";

const EXTENDED_USER_AGENT = "folio-perp-history/1.0";
const PAGINATION_LIMIT = 200;
const MAX_PAGES = 20;

interface ExtendedErrorPayload {
  code?: number;
  message?: string;
}

interface ExtendedPagination {
  cursor?: number | string;
  count?: number;
}

interface ExtendedApiResponse<T> {
  status?: string;
  data?: T;
  error?: ExtendedErrorPayload;
  pagination?: ExtendedPagination;
}

interface ExtendedAccountInfo {
  status?: string;
  l2Key?: string;
  l2Vault?: number | string;
  accountId?: number | string;
  description?: string;
}

interface ExtendedBalanceRow {
  balance?: string;
  equity?: string;
  availableForTrade?: string;
  availableForWithdrawal?: string;
  unrealisedPnl?: string;
  initialMargin?: string;
  marginRatio?: string;
  exposure?: string;
  leverage?: string;
  updatedTime?: number | string;
}

interface ExtendedTradeRow {
  id?: number | string;
  accountId?: number | string;
  market?: string;
  fee?: string;
  value?: string;
  filledQty?: string;
  tradeType?: string;
  createdTime?: number | string;
}

interface ExtendedPositionHistoryRow {
  id?: number | string;
  market?: string;
  side?: string;
  exitType?: string;
  size?: string;
  value?: string;
  openPrice?: string;
  exitPrice?: string;
  markPrice?: string;
  liquidationPrice?: string;
  margin?: string;
  unrealisedPnl?: string;
  realisedPnl?: string;
  createdTime?: number | string;
  updatedTime?: number | string;
  openTime?: number | string;
  closeTime?: number | string;
  closedTime?: number | string;
}

interface ExtendedFundingRow {
  id?: number | string;
  accountId?: number | string;
  market?: string;
  positionId?: number | string;
  side?: string;
  size?: string;
  value?: string;
  markPrice?: string;
  fundingFee?: string;
  fundingRate?: string;
  payment?: string;
  amount?: string;
  createdTime?: number | string;
  updatedTime?: number | string;
  paidTime?: number | string;
}

interface ExtendedAssetOperationRow {
  id?: number | string;
  type?: string;
  status?: string;
  amount?: string;
  createdTime?: number | string;
  updatedTime?: number | string;
}

interface ExtendedOrderHistoryRow {
  id?: number | string;
  market?: string;
  status?: string;
  type?: string;
  side?: string;
  payedFee?: string;
  createdTime?: number | string;
  updatedTime?: number | string;
}

type ExtendedFetchResult<T> =
  | { ok: true; data: T; pagination?: ExtendedPagination }
  | { ok: false; status?: number; error: string };

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeHex(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function toIsoTimestamp(value: unknown): string | undefined {
  const numeric = toNumber(value);
  if (!numeric || numeric <= 0) return undefined;

  const millis = numeric > 1e12 ? numeric : numeric * 1000;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function collectTimestamps(...rows: readonly object[]): string[] {
  return rows
    .flatMap((row) => {
      const record = row as Record<string, unknown>;
      return [
        toIsoTimestamp(record.createdTime),
        toIsoTimestamp(record.updatedTime),
        toIsoTimestamp(record.openTime),
        toIsoTimestamp(record.closeTime),
        toIsoTimestamp(record.closedTime),
        toIsoTimestamp(record.paidTime),
      ];
    })
    .filter((value): value is string => Boolean(value));
}

async function fetchExtendedJson<T>(
  path: string,
  params?: Record<string, string>,
): Promise<ExtendedFetchResult<T>> {
  try {
    const url = new URL(path, EXTENDED_API_BASE_URL);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": EXTENDED_USER_AGENT,
        "X-Api-Key": EXTENDED_API_KEY,
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      const body = await res.text();
      return {
        ok: false,
        status: res.status,
        error: `Extended ${path} returned HTTP ${res.status}${body ? `: ${body.slice(0, 160)}` : ""}`,
      };
    }

    const payload = await res.json() as ExtendedApiResponse<T>;
    if ((payload.status ?? "").toUpperCase() === "ERROR") {
      return {
        ok: false,
        error: `Extended ${path} returned API error${payload.error?.message ? `: ${payload.error.message}` : ""}`,
      };
    }

    return {
      ok: true,
      data: payload.data as T,
      pagination: payload.pagination,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : `Unknown Extended ${path} error`,
    };
  }
}

async function fetchExtendedPaginated<T extends object>(
  path: string,
  params?: Record<string, string>,
): Promise<ExtendedFetchResult<T[]>> {
  const collected: T[] = [];
  let cursor: string | undefined;
  const seenCursors = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const pageParams: Record<string, string> = {
      ...(params ?? {}),
      limit: String(PAGINATION_LIMIT),
    };

    if (cursor) {
      pageParams.cursor = cursor;
    }

    const result = await fetchExtendedJson<T[]>(path, pageParams);
    if (!result.ok) return result;

    const rows = Array.isArray(result.data) ? result.data : [];
    collected.push(...rows);

    const nextCursor = result.pagination?.cursor;
    const normalizedCursor = nextCursor === undefined || nextCursor === null ? "" : String(nextCursor);
    if (!normalizedCursor || rows.length === 0 || seenCursors.has(normalizedCursor)) {
      break;
    }

    seenCursors.add(normalizedCursor);
    cursor = normalizedCursor;
  }

  return { ok: true, data: collected };
}

function buildConfigMismatchCandidate(
  evidence: string[],
  notes: string,
): PerpDiscoveryCandidate {
  return {
    protocolId: "extended",
    protocolName: "Extended",
    chain: "Starknet / Extended",
    addressKind: "evm",
    status: "unscanned",
    confidence: "low",
    evidence,
    notes,
  };
}

function isExpectedZeroBalance404(result: ExtendedFetchResult<ExtendedBalanceRow>): boolean {
  return !result.ok && result.status === 404;
}

function sumNumeric<T>(rows: T[], select: (row: T) => unknown): number {
  return rows.reduce((total, row) => total + toNumber(select(row)), 0);
}

function countOpenPositions(rows: ExtendedPositionHistoryRow[]): number {
  return rows.filter((row) => Math.abs(toNumber(row.size)) > 0 && !row.closedTime && !row.closeTime).length;
}

export async function discoverExtendedHistory(address: string): Promise<PerpDiscoveryCandidate | null> {
  if (!EXTENDED_EVM_ADDRESS) return null;
  if (address.toLowerCase() !== EXTENDED_EVM_ADDRESS) return null;

  if (!EXTENDED_API_KEY) {
    return buildConfigMismatchCandidate(
      ["Extended wallet matched the configured EVM address, but EXTENDED_API_KEY is missing."],
      "Extended read-only history uses the API key only. Add EXTENDED_API_KEY first, then the isolated adapter can scan private GET endpoints safely.",
    );
  }

  const [accountInfoRes, balanceRes, tradesRes, positionsRes, fundingRes, assetOpsRes, ordersRes] = await Promise.all([
    fetchExtendedJson<ExtendedAccountInfo>("/api/v1/user/account/info"),
    fetchExtendedJson<ExtendedBalanceRow>("/api/v1/user/balance"),
    fetchExtendedPaginated<ExtendedTradeRow>("/api/v1/user/trades"),
    fetchExtendedPaginated<ExtendedPositionHistoryRow>("/api/v1/user/positions/history"),
    fetchExtendedPaginated<ExtendedFundingRow>("/api/v1/user/funding/history"),
    fetchExtendedPaginated<ExtendedAssetOperationRow>("/api/v1/user/assetOperations", { status: "COMPLETED" }),
    fetchExtendedPaginated<ExtendedOrderHistoryRow>("/api/v1/user/orders/history"),
  ]);

  const authFailure = [accountInfoRes, balanceRes, tradesRes, positionsRes, fundingRes, assetOpsRes, ordersRes].find(
    (result) => !result.ok && (result.status === 401 || result.status === 403),
  );

  if (authFailure && !authFailure.ok) {
    return buildConfigMismatchCandidate(
      [authFailure.error],
      "Extended API key auth failed for this configured wallet. Regenerate the API key in Extended API Management and keep the read-only scan in the isolated perp-history lane.",
    );
  }

  const accountInfo = accountInfoRes.ok ? accountInfoRes.data : null;
  const balance = balanceRes.ok
    ? balanceRes.data
    : isExpectedZeroBalance404(balanceRes)
      ? {
          balance: "0",
          equity: "0",
          availableForTrade: "0",
          availableForWithdrawal: "0",
          unrealisedPnl: "0",
          initialMargin: "0",
          marginRatio: "0",
          exposure: "0",
          leverage: "0",
        } satisfies ExtendedBalanceRow
      : null;

  if (!accountInfo || !balance) {
    const errors = [accountInfoRes, balanceRes]
      .filter((result): result is Extract<typeof result, { ok: false }> => !result.ok)
      .filter((result) => !(result.status === 404 && result === balanceRes))
      .map((result) => result.error);

    return buildConfigMismatchCandidate(
      errors.length > 0 ? errors : ["Extended account info or balance could not be loaded."],
      "The read-only Extended scan could not verify the configured sub-account, so this wallet remains unscanned for now.",
    );
  }

  const keyMatches = !EXTENDED_PUBLIC_KEY || normalizeHex(accountInfo.l2Key) === normalizeHex(EXTENDED_PUBLIC_KEY);
  const vaultMatches = !EXTENDED_VAULT || String(accountInfo.l2Vault ?? "") === EXTENDED_VAULT;

  if (!keyMatches || !vaultMatches) {
    return buildConfigMismatchCandidate(
      [
        "Extended API key authenticated successfully, but the returned sub-account does not match the configured Stark key or vault.",
        ...(keyMatches ? [] : ["Configured EXTENDED_PUBLIC_KEY does not match /api/v1/user/account/info l2Key."]),
        ...(vaultMatches ? [] : ["Configured EXTENDED_VAULT does not match /api/v1/user/account/info l2Vault."]),
      ],
      "The API key appears to belong to a different Extended sub-account. Use the matching API Management credential set for the wallet/sub-account you want to analyze.",
    );
  }

  const scanErrors = [tradesRes, positionsRes, fundingRes, assetOpsRes, ordersRes]
    .filter((result): result is Extract<typeof result, { ok: false }> => !result.ok)
    .map((result) => result.error);

  const trades = tradesRes.ok ? tradesRes.data : [];
  const positionsHistory = positionsRes.ok ? positionsRes.data : [];
  const fundingHistory = fundingRes.ok ? fundingRes.data : [];
  const assetOperations = assetOpsRes.ok ? assetOpsRes.data : [];
  const ordersHistory = ordersRes.ok ? ordersRes.data : [];

  const currentAccountValue = toNumber(balance.equity);
  const realizedPnl = sumNumeric(positionsHistory, (row) => row.realisedPnl);
  const unrealizedPnl = toNumber(balance.unrealisedPnl);
  const totalFunding = sumNumeric(fundingHistory, (row) => row.fundingFee ?? row.payment ?? row.amount);
  const totalFees = sumNumeric(trades, (row) => row.fee);
  const totalVolume = sumNumeric(trades, (row) => row.value);
  const fillCount = trades.length;
  const openPositionCount = countOpenPositions(positionsHistory);
  const netLifetimePnl = realizedPnl + unrealizedPnl + totalFunding - totalFees;

  const nonZeroAssetOps = assetOperations.filter((row) => Math.abs(toNumber(row.amount)) > 0);
  const detected = (
    currentAccountValue > 0 ||
    fillCount > 0 ||
    positionsHistory.length > 0 ||
    fundingHistory.length > 0 ||
    nonZeroAssetOps.length > 0 ||
    ordersHistory.length > 0
  );

  if (!detected) {
    if (scanErrors.length > 0) {
      return buildConfigMismatchCandidate(
        scanErrors,
        "The Extended read-only scan only completed partially, so this wallet remains unscanned for now.",
      );
    }

    return {
      protocolId: "extended",
      protocolName: "Extended",
      chain: "Starknet / Extended",
      addressKind: "evm",
      status: "not_detected",
      confidence: "low",
      evidence: ["Authenticated Extended read-only scan found no balance, trade, position, funding, asset-operation, or order history for this sub-account."],
      notes: "Extended read-only support is wired. If you traded through a different Extended sub-account, use that sub-account's API key and vault details instead.",
    };
  }

  const timestamps = [
    ...collectTimestamps(accountInfo, balance),
    ...collectTimestamps(...trades),
    ...collectTimestamps(...positionsHistory),
    ...collectTimestamps(...fundingHistory),
    ...collectTimestamps(...assetOperations),
    ...collectTimestamps(...ordersHistory),
  ].sort();

  const evidence: string[] = [
    "Authenticated via Extended read-only API key",
    "Read-only scan used private GET endpoints only; no Stark-signed write actions were performed.",
  ];
  if (isExpectedZeroBalance404(balanceRes)) {
    evidence.push("Extended balance endpoint returned HTTP 404, which the docs define as a zero-balance account.");
  }

  if (EXTENDED_PUBLIC_KEY) {
    evidence.push("Extended l2Key matched the configured Stark public key.");
  }
  if (EXTENDED_VAULT) {
    evidence.push("Extended l2Vault matched the configured vault number.");
  }
  if (EXTENDED_PRIVATE_KEY) {
    evidence.push("Extended Stark private key is configured, but it was not used for this read-only scan.");
  }
  if (currentAccountValue > 0) {
    evidence.push(`Current Extended equity ${currentAccountValue.toFixed(2)}`);
  }
  if (fillCount > 0) {
    evidence.push(`${fillCount} Extended trade record${fillCount === 1 ? "" : "s"} loaded`);
  }
  if (positionsHistory.length > 0) {
    evidence.push(`${positionsHistory.length} Extended position history record${positionsHistory.length === 1 ? "" : "s"} loaded`);
  }
  if (fundingHistory.length > 0) {
    evidence.push(`${fundingHistory.length} Extended funding history record${fundingHistory.length === 1 ? "" : "s"} loaded`);
  }
  if (nonZeroAssetOps.length > 0) {
    evidence.push(`${nonZeroAssetOps.length} non-zero Extended asset operation${nonZeroAssetOps.length === 1 ? "" : "s"} loaded`);
  }
  if (scanErrors.length > 0) {
    evidence.push(`Partial Extended scan warnings: ${scanErrors.join(" | ")}`);
  }
  if (EXTENDED_CLIENT_ID) {
    evidence.push("Extended client ID is configured for this wallet.");
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
    protocolId: "extended",
    protocolName: "Extended",
    chain: "Starknet / Extended",
    addressKind: "evm",
    status: "detected",
    confidence: fillCount > 0 || positionsHistory.length > 0 ? "high" : "medium",
    evidence,
    notes: "Detected with Extended private read-only endpoints for the configured sub-account. Lifetime stats are computed from balance, trades, positions history, funding history, and asset operations. If you used multiple Extended sub-accounts, query each credential set separately.",
    metrics: Object.values(metrics).some((value) => value !== undefined && value !== 0) ? metrics : undefined,
    firstSeen: timestamps[0],
    lastSeen: timestamps.length > 0 ? timestamps[timestamps.length - 1] : undefined,
    interactionCount: fillCount + positionsHistory.length + fundingHistory.length + nonZeroAssetOps.length || undefined,
  };
}
