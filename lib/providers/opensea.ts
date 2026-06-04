import type { NftHolding } from "../../types/index.ts";

// Minimum estimated floor value to display. 0 = show any NFT with a real,
// positive floor price (the spam guard); set higher to hide low-value items.
export const NFT_MIN_VISIBLE_USD = 0;

interface OpenSeaNft {
  identifier: string;
  collection?: string;
  contract: string;
  name?: string;
  image_url?: string;
  display_image_url?: string;
  opensea_url?: string;
  is_disabled?: boolean;
  is_nsfw?: boolean;
}

interface OpenSeaCollection {
  collection: string;
  name?: string;
  image_url?: string;
  safelist_status?: string;
  is_disabled?: boolean;
  is_nsfw?: boolean;
  opensea_url?: string;
  pricing_currencies?: {
    listing_currency?: OpenSeaPricingCurrency;
    offer_currency?: OpenSeaPricingCurrency;
  };
}

interface OpenSeaPricingCurrency {
  symbol?: string;
  usd_price?: string;
}

interface OpenSeaCollectionStats {
  total?: {
    floor_price?: number;
    floor_price_symbol?: string;
  };
}

interface OpenSeaAccountResponse {
  nfts?: OpenSeaNft[];
  next?: string;
}

export interface OpenSeaCollectionEvidence {
  collection: OpenSeaCollection;
  stats: OpenSeaCollectionStats;
}

export interface OpenSeaFetchResult {
  nfts: NftHolding[];
  scannedCount: number;
  collectionsScanned: number;
  filteredCount: number;
  candidateCollectionCount: number;
  collectionOffset: number;
  nextCollectionCursor?: number;
  incompleteCoverage: boolean;
  note?: string;
}

interface InstantApiKeyResponse {
  api_key?: string;
  expires_at?: string;
}

const REJECTED_LABELS = /\b(oat|poap|proof\s+of\s+attendance|attendance\s+badge|soulbound|airdrop|spam|voucher|claim\s+reward|free\s+mint)\b/i;
const STABLE_SYMBOLS = new Set(["USD", "USDC", "USDT", "DAI"]);
const EVM_CHAINS = ["ethereum", "base", "polygon", "arbitrum", "optimism"];
const MAX_OWNED_PAGES_PER_CHAIN = 3;
const MAX_COLLECTIONS_PER_SCAN = 10;
const INVENTORY_TTL_MS = 60_000;
let instantApiKeyCache: { key: string; expiresAt: number } | undefined;
let ownedNftCache = new Map<string, {
  expiresAt: number;
  nfts: Array<OpenSeaNft & { chain: string }>;
  failedChainCount: number;
}>();

function toPositiveNumber(value: unknown): number | undefined {
  const numberValue = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined;
}

function floorValueUsd(evidence: OpenSeaCollectionEvidence): { floorPrice: number; symbol: string; valueUsd: number } | undefined {
  const floorPrice = toPositiveNumber(evidence.stats.total?.floor_price);
  const symbol = evidence.stats.total?.floor_price_symbol?.toUpperCase();
  if (!floorPrice || !symbol) return undefined;
  if (STABLE_SYMBOLS.has(symbol)) return { floorPrice, symbol, valueUsd: floorPrice };

  const currencies = Object.values(evidence.collection.pricing_currencies ?? {});
  const matching = currencies.find((currency) => currency?.symbol?.toUpperCase() === symbol);
  const unitUsd = toPositiveNumber(matching?.usd_price);
  return unitUsd ? { floorPrice, symbol, valueUsd: floorPrice * unitUsd } : undefined;
}

export function screenOpenSeaNfts(
  rawNfts: Array<OpenSeaNft & { chain: string }>,
  evidenceByCollection: Map<string, OpenSeaCollectionEvidence>
): NftHolding[] {
  return rawNfts.flatMap((nft) => {
    const slug = nft.collection?.trim();
    if (!slug || nft.is_disabled || nft.is_nsfw) return [];
    const evidence = evidenceByCollection.get(slug);
    const collection = evidence?.collection;
    // Include unverified collections too — spam is filtered by REJECTED_LABELS,
    // nsfw/disabled flags, and the "must have a real floor price" guard below.
    if (!evidence || !collection) return [];
    if (collection.is_disabled || collection.is_nsfw) return [];
    const isVerified = collection.safelist_status?.toLowerCase() === "verified";

    const name = nft.name?.trim();
    const collectionName = collection.name?.trim();
    const imageUrl = nft.display_image_url || nft.image_url || collection.image_url;
    const openseaUrl = nft.opensea_url || collection.opensea_url;
    const searchableLabel = `${name ?? ""} ${collectionName ?? ""} ${slug}`;
    if (!name || !collectionName || !imageUrl || !openseaUrl || REJECTED_LABELS.test(searchableLabel)) return [];

    // Spam guard: require a real, positive floor price (scam airdrops have none).
    const value = floorValueUsd(evidence);
    if (!value || value.valueUsd <= 0) return [];

    return [{
      id: `${nft.chain}:${nft.contract}:${nft.identifier}`,
      identifier: nft.identifier,
      name,
      collectionName,
      collectionSlug: slug,
      imageUrl,
      openseaUrl,
      contract: nft.contract,
      chain: nft.chain,
      floorPrice: value.floorPrice,
      floorPriceSymbol: value.symbol,
      estimatedValueUsd: value.valueUsd,
      safelistStatus: isVerified ? ("verified" as const) : ("unverified" as const),
    }];
  }).sort((left, right) => right.estimatedValueUsd - left.estimatedValueUsd);
}

function isCollectionCandidate(nft: OpenSeaNft & { chain: string }): boolean {
  const name = nft.name?.trim();
  const collection = nft.collection?.trim();
  const imageUrl = nft.display_image_url || nft.image_url;
  const label = `${name ?? ""} ${collection ?? ""}`;
  return Boolean(name && collection && imageUrl && !nft.is_disabled && !nft.is_nsfw && !REJECTED_LABELS.test(label));
}

export async function getOpenSeaApiKey(): Promise<{ key: string; accessMode: "configured" | "instant-free" }> {
  const configuredKey = process.env.OPENSEA_API_KEY?.trim();
  if (configuredKey) return { key: configuredKey, accessMode: "configured" };

  const now = Date.now();
  if (instantApiKeyCache && instantApiKeyCache.expiresAt > now + 60_000) {
    return { key: instantApiKeyCache.key, accessMode: "instant-free" };
  }

  const response = await fetch("https://api.opensea.io/api/v2/auth/keys", {
    method: "POST",
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`OpenSea instant API key request failed (${response.status})`);
  const body = await response.json() as InstantApiKeyResponse;
  if (!body.api_key) throw new Error("OpenSea instant API key response did not include a key.");
  const expiresAt = body.expires_at ? new Date(body.expires_at).getTime() : now + 29 * 24 * 60 * 60 * 1000;
  instantApiKeyCache = {
    key: body.api_key,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : now + 29 * 24 * 60 * 60 * 1000,
  };
  return { key: body.api_key, accessMode: "instant-free" };
}

async function openSeaGet<T>(path: string, apiKey: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`https://api.opensea.io/api/v2${path}`, {
      headers: { accept: "application/json", "x-api-key": apiKey },
      signal: controller.signal,
      next: { revalidate: 60 },
    });
    if (!response.ok) throw new Error(`OpenSea request failed (${response.status})`);
    return await response.json() as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchOwnedNftsForChain(address: string, chain: string, apiKey: string) {
  const owned: Array<OpenSeaNft & { chain: string }> = [];
  let next: string | undefined;
  for (let page = 0; page < MAX_OWNED_PAGES_PER_CHAIN; page += 1) {
    const query = new URLSearchParams({ limit: "50" });
    if (next) query.set("next", next);
    const response = await openSeaGet<OpenSeaAccountResponse>(
      `/chain/${encodeURIComponent(chain)}/account/${encodeURIComponent(address)}/nfts?${query.toString()}`,
      apiKey
    );
    owned.push(...(response.nfts ?? []).map((nft) => ({ ...nft, chain })));
    next = response.next;
    if (!next) break;
  }
  return owned;
}

async function fetchOwnedNftInventory(address: string, apiKey: string, addressKind: "evm" | "solana") {
  const cacheKey = `${addressKind}:${address}`;
  const cached = ownedNftCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const chains = addressKind === "solana" ? ["solana"] : EVM_CHAINS;
  const accountResults = await Promise.allSettled(
    chains.map((chain) => fetchOwnedNftsForChain(address, chain, apiKey))
  );
  if (accountResults.every((result) => result.status === "rejected")) {
    throw new Error("OpenSea account requests failed for every supported chain.");
  }

  const inventory = {
    expiresAt: Date.now() + INVENTORY_TTL_MS,
    nfts: accountResults.flatMap((result) => result.status === "fulfilled" ? result.value : []),
    failedChainCount: accountResults.filter((result) => result.status === "rejected").length,
  };
  ownedNftCache.set(cacheKey, inventory);
  if (ownedNftCache.size > 100) {
    ownedNftCache = new Map([...ownedNftCache].filter(([, value]) => value.expiresAt > Date.now()));
  }
  return inventory;
}

export async function fetchVisibleOpenSeaNfts(
  address: string,
  apiKey: string,
  addressKind: "evm" | "solana",
  collectionOffset = 0
): Promise<OpenSeaFetchResult> {
  const inventory = await fetchOwnedNftInventory(address, apiKey, addressKind);
  const rawNfts = inventory.nfts;
  const candidateNfts = rawNfts.filter(isCollectionCandidate);
  const collectionSlugs = [...new Set(
    candidateNfts.map((nft) => nft.collection?.trim()).filter((slug): slug is string => Boolean(slug))
  )];
  const offset = Math.max(0, Math.min(Math.floor(collectionOffset), collectionSlugs.length));
  const scannedSlugs = collectionSlugs.slice(offset, offset + MAX_COLLECTIONS_PER_SCAN);
  const scannedSlugSet = new Set(scannedSlugs);
  const candidateBatch = candidateNfts.filter((nft) => scannedSlugSet.has(nft.collection?.trim() ?? ""));
  const evidenceResults = await Promise.allSettled(scannedSlugs.map(async (slug) => {
    const [collection, stats] = await Promise.all([
      openSeaGet<OpenSeaCollection>(`/collections/${encodeURIComponent(slug)}`, apiKey),
      openSeaGet<OpenSeaCollectionStats>(`/collections/${encodeURIComponent(slug)}/stats`, apiKey),
    ]);
    return [slug, { collection, stats }] as const;
  }));
  const evidence = new Map(
    evidenceResults
      .filter((result): result is PromiseFulfilledResult<readonly [string, OpenSeaCollectionEvidence]> => result.status === "fulfilled")
      .map((result) => result.value)
  );
  const nfts = screenOpenSeaNfts(candidateBatch, evidence);
  const failedCollectionCount = evidenceResults.filter((result) => result.status === "rejected").length;
  const nextCollectionCursor = failedCollectionCount
    ? offset
    : offset + scannedSlugs.length < collectionSlugs.length
      ? offset + scannedSlugs.length
      : undefined;
  const incompleteCoverage = Boolean(nextCollectionCursor || failedCollectionCount || inventory.failedChainCount);
  const notes = [
    nextCollectionCursor !== undefined && !failedCollectionCount
      ? `${collectionSlugs.length - nextCollectionCursor} candidate collection(s) remain to be screened.`
      : undefined,
    failedCollectionCount
      ? `${failedCollectionCount} collection check(s) did not complete; retry this scan after the OpenSea rate window resets.`
      : undefined,
    inventory.failedChainCount
      ? `${inventory.failedChainCount} supported network request(s) did not complete.`
      : undefined,
  ].filter(Boolean);

  return {
    nfts,
    scannedCount: rawNfts.length,
    collectionsScanned: evidence.size,
    filteredCount: Math.max(0, candidateBatch.length - nfts.length),
    candidateCollectionCount: collectionSlugs.length,
    collectionOffset: offset,
    nextCollectionCursor,
    incompleteCoverage,
    note: notes.length ? notes.join(" ") : undefined,
  };
}
