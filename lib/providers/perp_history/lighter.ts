import type { PerpDiscoveryCandidate, PerpDiscoveryMetrics } from "./types";

const LIGHTER_API_BASE_URL = process.env.LIGHTER_API_BASE_URL ?? "https://mainnet.zklighter.elliot.ai";
const LIGHTER_ACCOUNTS_API = "https://mainnet.zklighter.elliot.ai/api/v1/accountsByL1Address";
const LIGHTER_EXPLORER_BASE = "https://explorer.elliot.ai/api/accounts";
const LIGHTER_EVM_ADDRESS = (process.env.LIGHTER_EVM_ADDRESS ?? "").toLowerCase();
const LIGHTER_READONLY_TOKEN = process.env.LIGHTER_READONLY_TOKEN ?? "";
const LIGHTER_ACCOUNT_INDEX = process.env.LIGHTER_ACCOUNT_INDEX ?? "";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toIsoTimestamp(value: unknown): string | undefined {
  const numeric = toNumber(value);
  if (!numeric || numeric <= 0) return undefined;

  const millis = numeric > 1e12 ? numeric : numeric * 1000;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

async function fetchLighterApiJson<T>(
  path: string,
  params?: Record<string, string>,
): Promise<
  | { ok: true; data: T }
  | { ok: false; status?: number; error: string }
> {
  try {
    const url = new URL(path, LIGHTER_API_BASE_URL);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        Authorization: LIGHTER_READONLY_TOKEN,
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      const body = await res.text();
      return {
        ok: false,
        status: res.status,
        error: `Lighter ${path} returned HTTP ${res.status}${body ? `: ${body.slice(0, 160)}` : ""}`,
      };
    }

    return {
      ok: true,
      data: await res.json() as T,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : `Unknown Lighter ${path} error`,
    };
  }
}

function collectAccountIds(node: unknown, found = new Set<string>(), depth = 0): Set<string> {
  if (depth > 6) return found;

  if (Array.isArray(node)) {
    for (const item of node) collectAccountIds(item, found, depth + 1);
    return found;
  }

  if (!isRecord(node)) return found;

  for (const key of ["index", "account_index", "accountIndex", "account_id", "accountId", "id", "account"] as const) {
    const value = node[key];
    if (typeof value === "string" && value.trim() !== "") found.add(value.trim());
    if (typeof value === "number" && Number.isFinite(value)) found.add(String(value));
  }

  for (const key of ["accounts", "sub_accounts", "subAccounts", "data", "result", "results"] as const) {
    collectAccountIds(node[key], found, depth + 1);
  }

  return found;
}

function isLikelyPositionRecord(value: unknown): value is JsonRecord {
  return isRecord(value) && (
    "market_id" in value ||
    "symbol" in value ||
    "position_value" in value ||
    "avg_entry_price" in value ||
    "unrealized_pnl" in value
  );
}

function collectPositionRecords(node: unknown, found: JsonRecord[] = [], depth = 0): JsonRecord[] {
  if (depth > 6) return found;

  if (Array.isArray(node)) {
    for (const item of node) collectPositionRecords(item, found, depth + 1);
    return found;
  }

  if (!isRecord(node)) return found;

  if (isLikelyPositionRecord(node)) found.push(node);

  const positions = node.positions;
  if (Array.isArray(positions)) {
    collectPositionRecords(positions, found, depth + 1);
  } else if (isRecord(positions)) {
    collectPositionRecords(Object.values(positions), found, depth + 1);
  }

  for (const key of ["data", "result", "results"] as const) {
    collectPositionRecords(node[key], found, depth + 1);
  }

  return found;
}

function isLikelyLogRecord(value: unknown): value is JsonRecord {
  return isRecord(value) && (
    "timestamp" in value ||
    "created_at" in value ||
    "updated_at" in value ||
    "block_height" in value ||
    "tx_hash" in value ||
    "transaction_hash" in value
  );
}

function collectLogRecords(node: unknown, found: JsonRecord[] = [], depth = 0): JsonRecord[] {
  if (depth > 6) return found;

  if (Array.isArray(node)) {
    for (const item of node) collectLogRecords(item, found, depth + 1);
    return found;
  }

  if (!isRecord(node)) return found;

  if (isLikelyLogRecord(node)) found.push(node);

  for (const key of ["logs", "data", "result", "results"] as const) {
    collectLogRecords(node[key], found, depth + 1);
  }

  return found;
}

function extractTimeline(records: JsonRecord[]): { firstSeen?: string; lastSeen?: string } {
  const timestamps = records
    .flatMap((record) => [
      toIsoTimestamp(record.timestamp),
      toIsoTimestamp(record.created_at),
      toIsoTimestamp(record.updated_at),
      toIsoTimestamp(record.opened_at),
    ])
    .filter((value): value is string => Boolean(value))
    .sort();

  return {
    firstSeen: timestamps[0],
    lastSeen: timestamps.length > 0 ? timestamps[timestamps.length - 1] : undefined,
  };
}

function sumNumeric(records: JsonRecord[], keys: string[]): number {
  return records.reduce((total, record) => {
    const value = keys.map((key) => toNumber(record[key])).find((item): item is number => item !== null) ?? 0;
    return total + value;
  }, 0);
}

function sumTradeNotional(records: JsonRecord[]): number {
  return records.reduce((total, record) => {
    const directValue = toNumber(record.value) ?? toNumber(record.notional) ?? toNumber(record.quote_amount);
    if (directValue !== null) return total + Math.abs(directValue);

    const price = toNumber(record.price);
    const size = toNumber(record.size) ?? toNumber(record.amount) ?? toNumber(record.base_amount);
    if (price !== null && size !== null) {
      return total + Math.abs(price * size);
    }

    return total;
  }, 0);
}

function countOpenPositionRecords(records: JsonRecord[]): number {
  return records.filter((record) => {
    const position = toNumber(record.position) ?? toNumber(record.size);
    if (position === null || position === 0) return false;

    const status = typeof record.status === "string" ? record.status.toUpperCase() : "";
    if (status) {
      return status === "OPEN" || status === "ACTIVE";
    }

    return true;
  }).length;
}

function collectRecordsByKeys(
  node: unknown,
  candidateKeys: string[],
  found: JsonRecord[] = [],
  depth = 0,
): JsonRecord[] {
  if (depth > 6) return found;

  if (Array.isArray(node)) {
    for (const item of node) {
      if (isRecord(item)) found.push(item);
      collectRecordsByKeys(item, candidateKeys, found, depth + 1);
    }
    return found;
  }

  if (!isRecord(node)) return found;

  for (const key of candidateKeys) {
    collectRecordsByKeys(node[key], candidateKeys, found, depth + 1);
  }

  return found;
}

function pickNumber(record: JsonRecord | null | undefined, keys: string[]): number | null {
  if (!record) return null;

  for (const key of keys) {
    const value = toNumber(record[key]);
    if (value !== null) return value;
  }

  return null;
}

function extractPrimaryRecord(node: unknown, candidateKeys: string[]): JsonRecord | null {
  if (isRecord(node)) {
    for (const key of candidateKeys) {
      const nested = node[key];
      if (isRecord(nested)) return nested;
    }
    return node;
  }

  if (Array.isArray(node)) {
    const first = node.find((item) => isRecord(item));
    return isRecord(first) ? first : null;
  }

  return null;
}

async function fetchLighterWithParamFallback<T>(
  path: string,
  accountIndex: string,
): Promise<
  | { ok: true; data: T; paramKey: string }
  | { ok: false; status?: number; error: string }
> {
  const attempts: Array<{ paramKey: string; params: Record<string, string> }> = [
    { paramKey: "account_index", params: { account_index: accountIndex } },
    { paramKey: "index", params: { index: accountIndex } },
    { paramKey: "accountIndex", params: { accountIndex: accountIndex } },
    { paramKey: "account_id", params: { account_id: accountIndex } },
  ];

  let lastError: { ok: false; status?: number; error: string } | null = null;

  for (const attempt of attempts) {
    const result = await fetchLighterApiJson<T>(path, attempt.params);
    if (result.ok) {
      return { ok: true, data: result.data, paramKey: attempt.paramKey };
    }

    lastError = result;
    if (result.status && ![400, 404].includes(result.status)) {
      return result;
    }
  }

  return lastError ?? { ok: false, error: `Lighter ${path} failed for all known account-index param variants` };
}

async function fetchLighterExplorerRecords(
  path: "positions" | "logs",
  refs: string[],
): Promise<{ records: JsonRecord[]; errors: string[] }> {
  const settled = await Promise.all(
    refs.map(async (ref) => {
      const url = `${LIGHTER_EXPLORER_BASE}/${encodeURIComponent(ref)}/${path}`;

      try {
        const res = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(12_000),
        });

        if (res.status === 404) {
          return { records: [] as JsonRecord[], error: null as string | null };
        }
        if (!res.ok) {
          return {
            records: [] as JsonRecord[],
            error: `Lighter explorer ${path} returned HTTP ${res.status} for ${ref}`,
          };
        }

        const body = await res.json();
        return {
          records: path === "positions" ? collectPositionRecords(body) : collectLogRecords(body),
          error: null as string | null,
        };
      } catch (error) {
        return {
          records: [] as JsonRecord[],
          error: error instanceof Error ? error.message : `Unknown Lighter ${path} error for ${ref}`,
        };
      }
    }),
  );

  return {
    records: settled.flatMap((item) => item.records),
    errors: settled.map((item) => item.error).filter((value): value is string => Boolean(value)),
  };
}

export async function discoverLighterHistory(address: string): Promise<PerpDiscoveryCandidate | null> {
  const accountsUrl = `${LIGHTER_ACCOUNTS_API}?l1_address=${encodeURIComponent(address)}`;
  let accountIds: string[] = [];
  let accountsLookupError: string | undefined;

  try {
    const accountsRes = await fetch(accountsUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });

    if (accountsRes.ok) {
      const accountsBody = await accountsRes.json();
      accountIds = [...collectAccountIds(accountsBody)];
    } else {
      accountsLookupError = `Lighter wallet lookup returned HTTP ${accountsRes.status}`;
    }
  } catch (error) {
    accountsLookupError = error instanceof Error ? error.message : "Unknown Lighter wallet lookup error";
  }

  const explorerRefs = [...new Set([
    ...accountIds,
    address,
  ])];

  const [positionsScan, logsScan] = await Promise.all([
    fetchLighterExplorerRecords("positions", explorerRefs),
    fetchLighterExplorerRecords("logs", explorerRefs),
  ]);

  const positionRecords = positionsScan.records;
  const logRecords = logsScan.records;
  const foundPublicActivity = accountIds.length > 0 || positionRecords.length > 0 || logRecords.length > 0;

  const matchingConfiguredWallet = Boolean(
    LIGHTER_EVM_ADDRESS &&
    address.toLowerCase() === LIGHTER_EVM_ADDRESS,
  );
  const discoveredAccountIndex = accountIds[0] ?? undefined;
  const configuredAccountIndex = LIGHTER_ACCOUNT_INDEX || discoveredAccountIndex;

  if (matchingConfiguredWallet && LIGHTER_READONLY_TOKEN && configuredAccountIndex) {
    const [accountRes, tradesRes, inactiveOrdersRes, pnlRes] = await Promise.all([
      fetchLighterWithParamFallback<JsonRecord>("/api/v1/account", configuredAccountIndex),
      fetchLighterWithParamFallback<JsonRecord[]>("/api/v1/trades", configuredAccountIndex),
      fetchLighterWithParamFallback<JsonRecord[]>("/api/v1/accountInactiveOrders", configuredAccountIndex),
      fetchLighterWithParamFallback<JsonRecord>("/api/v1/pnl", configuredAccountIndex),
    ]);

    const authFailure = [accountRes, tradesRes, inactiveOrdersRes, pnlRes].find(
      (result) => !result.ok && (result.status === 401 || result.status === 403),
    );

    if (authFailure && !authFailure.ok) {
      return {
        protocolId: "lighter",
        protocolName: "Lighter",
        chain: "Ethereum / Lighter",
        addressKind: "evm",
        status: "unscanned",
        confidence: "low",
        evidence: [authFailure.error],
        notes: "Lighter read-only auth failed. Regenerate a valid read-only token for the configured account index.",
      };
    }

    const authErrors = [accountRes, tradesRes, inactiveOrdersRes, pnlRes]
      .filter((result): result is Extract<typeof result, { ok: false }> => !result.ok)
      .map((result) => result.error);

    const authAccount = accountRes.ok
      ? extractPrimaryRecord(accountRes.data, ["account", "data", "result"])
      : null;
    const authTrades = tradesRes.ok
      ? collectRecordsByKeys(tradesRes.data, ["trades", "fills", "data", "result", "results"])
      : [];
    const authOrders = inactiveOrdersRes.ok
      ? collectRecordsByKeys(inactiveOrdersRes.data, ["orders", "data", "result", "results"])
      : [];
    const authPnl = pnlRes.ok
      ? extractPrimaryRecord(pnlRes.data, ["pnl", "data", "result"])
      : null;

    const authPositionRecords = collectPositionRecords([
      authAccount?.positions,
      authPnl?.positions,
      authPnl?.open_positions,
      authPnl?.openPositions,
    ]);
    const combinedPositionRecords = [...positionRecords, ...authPositionRecords];

    const currentAccountValue =
      pickNumber(authAccount, ["portfolio_value", "portfolioValue", "collateral", "equity", "account_value", "accountValue"]) ??
      pickNumber(authPnl, ["portfolio_value", "portfolioValue", "equity", "account_value", "accountValue"]) ??
      0;
    const openPositionCount = countOpenPositionRecords(combinedPositionRecords);
    const realizedPnl =
      pickNumber(authPnl, ["realized_pnl", "realizedPnl"]) ??
      sumNumeric(combinedPositionRecords, ["realized_pnl", "realizedPnl"]) ??
      0;
    const unrealizedPnl =
      pickNumber(authPnl, ["unrealized_pnl", "unrealizedPnl"]) ??
      sumNumeric(combinedPositionRecords, ["unrealized_pnl", "unrealizedPnl"]) ??
      0;
    const totalFunding =
      pickNumber(authPnl, ["total_funding_paid_out", "totalFundingPaidOut", "funding_paid", "fundingPaid", "total_funding"]) ??
      sumNumeric(combinedPositionRecords, ["total_funding_paid_out", "totalFundingPaidOut", "funding_paid", "fundingPaid", "total_funding"]) ??
      0;
    const totalFees =
      sumNumeric(authTrades, ["fee", "fees_paid", "fee_paid", "feesPaid", "feePaid"]) ??
      0;
    const totalVolume =
      pickNumber(authAccount, ["total_volume", "totalVolume"]) ??
      pickNumber(authPnl, ["total_volume", "totalVolume"]) ??
      sumTradeNotional(authTrades);
    const fillCount = authTrades.length;
    const netLifetimePnl = realizedPnl + unrealizedPnl + totalFunding - totalFees;

    const timeline = extractTimeline([
      ...(authTrades as JsonRecord[]),
      ...(authOrders as JsonRecord[]),
      ...combinedPositionRecords,
      ...logRecords,
      ...(authAccount ? [authAccount] : []),
      ...(authPnl ? [authPnl] : []),
    ]);

    const detected = (
      currentAccountValue > 0 ||
      fillCount > 0 ||
      openPositionCount > 0 ||
      authOrders.length > 0 ||
      accountIds.length > 0
    );

    if (detected) {
      const evidence: string[] = [
        "Authenticated via Lighter read-only token",
        `Lighter account index ${configuredAccountIndex} selected for this wallet`,
      ];
      if (accountIds.length > 0) {
        evidence.push(`${accountIds.length} Lighter account${accountIds.length === 1 ? "" : "s"} linked to this Ethereum wallet`);
      }
      if (fillCount > 0) {
        evidence.push(`${fillCount} authenticated Lighter trade record${fillCount === 1 ? "" : "s"} loaded`);
      }
      if (authOrders.length > 0) {
        evidence.push(`${authOrders.length} authenticated Lighter inactive order${authOrders.length === 1 ? "" : "s"} loaded`);
      }
      if (openPositionCount > 0) {
        evidence.push(`${openPositionCount} Lighter open position${openPositionCount === 1 ? "" : "s"} found`);
      }
      if (currentAccountValue > 0) {
        evidence.push(`Current Lighter account value ${currentAccountValue.toFixed(2)}`);
      }
      if (Math.abs(realizedPnl) > 0) {
        evidence.push(`Lighter realized PnL ${realizedPnl.toFixed(2)}`);
      }
      if (Math.abs(totalFees) > 0) {
        evidence.push(`Lighter fees tracked ${totalFees.toFixed(2)}`);
      }
      if (Math.abs(totalFunding) > 0) {
        evidence.push(`Lighter funding tracked ${totalFunding.toFixed(2)}`);
      }
      if (authErrors.length > 0) {
        evidence.push(`Partial Lighter auth scan warnings: ${authErrors.join(" | ")}`);
      }

      const metrics: PerpDiscoveryMetrics = {
        openPositionCount,
        currentAccountValue,
        realizedPnl,
        unrealizedPnl,
        netLifetimePnl,
        totalFees,
        totalFunding,
        totalVolume: totalVolume || undefined,
        fillCount,
      };

      return {
        protocolId: "lighter",
        protocolName: "Lighter",
        chain: "Ethereum / Lighter",
        addressKind: "evm",
        status: "detected",
        confidence: fillCount > 0 ? "high" : "medium",
        evidence,
        notes: "Detected with a Lighter read-only token plus the wallet-linked account index. Metrics are computed from authenticated account/trades data and public position data.",
        metrics: Object.values(metrics).some((value) => value !== undefined && value !== 0) ? metrics : undefined,
        firstSeen: timeline.firstSeen,
        lastSeen: timeline.lastSeen,
        interactionCount: fillCount + authOrders.length + openPositionCount || undefined,
      };
    }

    if (authErrors.length > 0 && !foundPublicActivity) {
      return {
        protocolId: "lighter",
        protocolName: "Lighter",
        chain: "Ethereum / Lighter",
        addressKind: "evm",
        status: "unscanned",
        confidence: "low",
        evidence: authErrors,
        notes: "Lighter read-only auth did not complete cleanly, so this wallet remains unscanned for now.",
      };
    }
  }

  if (!foundPublicActivity) {
    const scanErrors = [
      accountsLookupError,
      ...positionsScan.errors,
      ...logsScan.errors,
    ].filter((value): value is string => Boolean(value));

    if (scanErrors.length > 0) {
      return {
        protocolId: "lighter",
        protocolName: "Lighter",
        chain: "Ethereum / Lighter",
        addressKind: "evm",
        status: "unscanned",
        confidence: "low",
        evidence: scanErrors,
        notes: "Lighter public discovery did not complete cleanly, so this protocol remains unscanned for now.",
      };
    }

    return {
      protocolId: "lighter",
      protocolName: "Lighter",
      chain: "Ethereum / Lighter",
      addressKind: "evm",
      status: "not_detected",
      confidence: "low",
      evidence: ["No public Lighter account, position, or explorer activity was found for this Ethereum wallet."],
      notes: "Scanned Lighter public wallet lookup and explorer endpoints only. Exact trade and PnL reconstruction still needs a dedicated adapter.",
    };
  }

  const timeline = extractTimeline(logRecords.length > 0 ? logRecords : positionRecords);
  const interactionCount = Math.max(logRecords.length, positionRecords.length, accountIds.length);
  const evidence = [];

  if (accountIds.length > 0) {
    evidence.push(`${accountIds.length} Lighter account${accountIds.length === 1 ? "" : "s"} linked to this Ethereum wallet`);
  }
  if (positionRecords.length > 0) {
    evidence.push(
      `${positionRecords.length} public Lighter position record${positionRecords.length === 1 ? "" : "s"} found`,
    );
  }
  if (logRecords.length > 0) {
    evidence.push(
      `${logRecords.length} public Lighter explorer log${logRecords.length === 1 ? "" : "s"} found`,
    );
  }

  return {
    protocolId: "lighter",
    protocolName: "Lighter",
    chain: "Ethereum / Lighter",
    addressKind: "evm",
    status: "detected",
    confidence: logRecords.length > 0 || positionRecords.length > 0 ? "medium" : "low",
    evidence,
    notes: "Detected from Lighter's public wallet-to-account lookup plus public explorer endpoints. Exact fills, fees, and lifetime PnL require a read-only auth token for stronger coverage.",
    metrics: positionRecords.length > 0 ? { openPositionCount: positionRecords.length } : undefined,
    firstSeen: timeline.firstSeen,
    lastSeen: timeline.lastSeen,
    interactionCount,
  };
}
