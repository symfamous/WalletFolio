const MOBULA_BASE = "https://api.mobula.io/api/2";

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export interface MobulaTokenAmount {
  address?: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  amountRaw?: string;
  amountFormatted?: number;
  priceUSD?: number;
  valueUSD?: number;
  logo?: string;
}

export interface MobulaPositionMetadata {
  type?: string;
  apy?: string | number;
  healthFactor?: string | number;
  collateralRatio?: string | number;
  liquidationPrice?: string | number;
  liquidationPriceQuote?: string | number;
  [key: string]: unknown;
}

export interface MobulaDefiPositionEntry {
  id: string;
  type?: string;
  name?: string;
  valueUSD?: number | string;
  tokens?: MobulaTokenAmount[];
  rewards?: MobulaTokenAmount[];
  metadata?: MobulaPositionMetadata;
}

export interface MobulaProtocolInfo {
  id: string;
  name: string;
  url?: string;
  logo?: string;
  category?: string;
}

export interface MobulaProtocolGroup {
  protocol: MobulaProtocolInfo;
  totalValueUSD?: string | number;
  positions: MobulaDefiPositionEntry[];
}

export interface MobulaDefiPositionsResponse {
  data?: {
    wallet?: string;
    fetchedAt?: string;
    totalValueUSD?: string | number;
    totalDepositedUSD?: string | number;
    totalBorrowedUSD?: string | number;
    totalRewardsUSD?: string | number;
    protocols?: MobulaProtocolGroup[];
  };
}

async function mobulaFetch<T>(
  url: string,
  apiKey: string,
  timeoutMs = 20_000,
): Promise<T> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: apiKey,
      },
      signal: ctrl.signal,
    });

    if (!res.ok) {
      throw new Error(`Mobula ${res.status}: ${await res.text()}`);
    }

    return res.json() as Promise<T>;
  } finally {
    clearTimeout(tid);
  }
}

function normalizeProtocolGroup(group: unknown): MobulaProtocolGroup | null {
  if (!group || typeof group !== "object") return null;

  const protocolCandidate =
    "protocol" in group && group.protocol && typeof group.protocol === "object"
      ? group.protocol
      : null;
  if (!protocolCandidate) return null;
  const protocolRecord = protocolCandidate as Record<string, unknown>;

  const protocolId =
    typeof protocolRecord.id === "string" && protocolRecord.id
      ? protocolRecord.id
      : typeof protocolRecord.name === "string" && protocolRecord.name
        ? protocolRecord.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
        : null;

  const protocolName =
    typeof protocolRecord.name === "string" && protocolRecord.name
      ? protocolRecord.name
      : protocolId;

  if (!protocolId || !protocolName) return null;

  const positions = Array.isArray((group as { positions?: unknown[] }).positions)
    ? ((group as { positions: unknown[] }).positions.filter((position): position is MobulaDefiPositionEntry => {
        if (!position || typeof position !== "object") return false;
        return typeof (position as { id?: unknown }).id === "string";
      }))
    : [];

  return {
    protocol: {
      id: protocolId,
      name: protocolName,
      url: typeof protocolRecord.url === "string" ? protocolRecord.url : undefined,
      logo: typeof protocolRecord.logo === "string" ? protocolRecord.logo : undefined,
      category: typeof protocolRecord.category === "string" ? protocolRecord.category : undefined,
    },
    totalValueUSD: toNumber((group as { totalValueUSD?: unknown }).totalValueUSD),
    positions,
  };
}

export async function fetchMobulaDefiPositions(
  address: string,
  apiKey?: string,
): Promise<MobulaDefiPositionsResponse> {
  if (!apiKey) {
    return { data: { wallet: address, protocols: [] } };
  }

  const url = `${MOBULA_BASE}/wallet/defi-positions?wallet=${encodeURIComponent(address)}&blockchains=solana`;
  const data = await mobulaFetch<MobulaDefiPositionsResponse>(url, apiKey);

  const rawProtocols = Array.isArray(data?.data?.protocols) ? data.data.protocols : [];
  const protocols = rawProtocols
    .map((group) => normalizeProtocolGroup(group))
    .filter((group): group is MobulaProtocolGroup => group !== null);

  const positionCount = protocols.reduce((sum, group) => sum + group.positions.length, 0);
  const totalValue = toNumber(data?.data?.totalValueUSD);
  console.info(
    `[mobula] ${protocols.length} protocols, ${positionCount} positions` +
      (totalValue !== undefined ? `, totalValueUSD: $${totalValue.toFixed(2)}` : ""),
  );

  return {
    data: {
      wallet: data?.data?.wallet ?? address,
      fetchedAt: data?.data?.fetchedAt,
      totalValueUSD: data?.data?.totalValueUSD,
      totalDepositedUSD: data?.data?.totalDepositedUSD,
      totalBorrowedUSD: data?.data?.totalBorrowedUSD,
      totalRewardsUSD: data?.data?.totalRewardsUSD,
      protocols,
    },
  };
}
