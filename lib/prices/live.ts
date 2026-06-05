import type { NormalizedPosition } from "@/types";

// ─── Live price enrichment ────────────────────────────────────────
//
// Balances come from the portfolio provider (Zerion/Zapper/Moralis) and change
// rarely. Prices change constantly, so we overlay a fresh price on top:
//
//   1. DefiLlama coins API (PRIMARY) — free, no key, not IP-throttled on Vercel,
//      and prices native gas assets (ETH/SOL/POL/…) plus long-tail tokens by
//      contract address in one batched call.
//   2. CoinGecko (FALLBACK) — only for tokens DefiLlama did not price. Also
//      supplies a 24h change where available.
//
// DefiLlama's current-price endpoint has no 24h change, so for DefiLlama-priced
// positions we keep whatever 24h change the provider already supplied (Zerion).

const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3";
const COINGECKO_TIMEOUT_MS = 1_800;
const COINGECKO_BATCH_SIZE = 80;

const LLAMA_API_BASE = "https://coins.llama.fi";
const LLAMA_TIMEOUT_MS = 2_500;
const LLAMA_BATCH_SIZE = 100;
const LLAMA_MIN_CONFIDENCE = 0.5;

const EVM_NATIVE_ADDRESS = "0x0000000000000000000000000000000000000000";
const SOL_WRAPPED_MINT = "So11111111111111111111111111111111111111112";

// CoinGecko platform ids (fallback path).
const PLATFORM_BY_CHAIN: Record<string, string> = {
  ethereum: "ethereum",
  arbitrum: "arbitrum-one",
  optimism: "optimistic-ethereum",
  base: "base",
  polygon: "polygon-pos",
  avalanche: "avalanche",
  fantom: "fantom",
  solana: "solana",
  "binance-smart-chain": "binance-smart-chain",
  gnosis: "xdai",
  "zksync-era": "zksync",
  linea: "linea",
  scroll: "scroll",
  blast: "blast",
  mantle: "mantle",
};

// DefiLlama chain prefixes (note: these differ from CoinGecko platform ids).
const LLAMA_CHAIN_BY_SLUG: Record<string, string> = {
  ethereum: "ethereum",
  arbitrum: "arbitrum",
  optimism: "optimism",
  base: "base",
  polygon: "polygon",
  avalanche: "avax",
  fantom: "fantom",
  solana: "solana",
  "binance-smart-chain": "bsc",
  gnosis: "xdai",
  "zksync-era": "era",
  linea: "linea",
  scroll: "scroll",
  blast: "blast",
  mantle: "mantle",
};

type CoinGeckoQuote = {
  usd?: number;
  usd_24h_change?: number | null;
};

function platformFor(chainSlug: string): string | undefined {
  return PLATFORM_BY_CHAIN[chainSlug];
}

function normalizeContractAddress(platform: string, address: string): string {
  return platform === "solana" ? address : address.toLowerCase();
}

function buildQuoteKey(platform: string, address: string): string {
  return `${platform}:${normalizeContractAddress(platform, address).toLowerCase()}`;
}

function isEligiblePosition(position: NormalizedPosition): boolean {
  const platform = platformFor(position.chainSlug);
  if (!platform) return false;
  if (!position.contractAddress || position.contractAddress === "native") return false;
  if (position.protocolId === "hyperliquid-perps") return false;
  return true;
}

// ─── DefiLlama (primary) ──────────────────────────────────────────

function isNativePosition(position: NormalizedPosition): boolean {
  return position.isNative || !position.contractAddress || position.contractAddress === "native";
}

/** The `{chain}:{address}` key DefiLlama expects, or undefined if unsupported. */
function llamaKeyFor(position: NormalizedPosition): string | undefined {
  if (position.protocolId === "hyperliquid-perps") return undefined;
  const chain = LLAMA_CHAIN_BY_SLUG[position.chainSlug];
  if (!chain) return undefined;

  if (isNativePosition(position)) {
    return chain === "solana" ? `solana:${SOL_WRAPPED_MINT}` : `${chain}:${EVM_NATIVE_ADDRESS}`;
  }
  const address = chain === "solana" ? position.contractAddress : position.contractAddress.toLowerCase();
  return `${chain}:${address}`;
}

/** Normalize a DefiLlama response key so its address casing matches our request keys. */
function normalizeLlamaKey(key: string): string {
  const idx = key.indexOf(":");
  if (idx < 0) return key;
  const chain = key.slice(0, idx);
  const addr = key.slice(idx + 1);
  return chain === "solana" ? key : `${chain}:${addr.toLowerCase()}`;
}

async function fetchLlamaPrices(keys: string[]): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();
  const uniqueKeys = [...new Set(keys)];

  const batches: string[][] = [];
  for (let index = 0; index < uniqueKeys.length; index += LLAMA_BATCH_SIZE) {
    batches.push(uniqueKeys.slice(index, index + LLAMA_BATCH_SIZE));
  }

  await Promise.allSettled(batches.map(async (batch) => {
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), LLAMA_TIMEOUT_MS);
    try {
      const res = await fetch(`${LLAMA_API_BASE}/prices/current/${batch.join(",")}`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 15 },
        signal: ctrl.signal,
      });
      if (!res.ok) return;

      const json = await res.json() as { coins?: Record<string, { price?: number; confidence?: number }> };
      for (const [key, coin] of Object.entries(json.coins ?? {})) {
        const price = coin?.price ?? 0;
        const confidence = coin?.confidence ?? 1;
        if (price <= 0 || confidence < LLAMA_MIN_CONFIDENCE) continue;
        priceMap.set(normalizeLlamaKey(key), price);
      }
    } catch {
      return;
    } finally {
      clearTimeout(timeoutId);
    }
  }));

  return priceMap;
}

// ─── CoinGecko (fallback) ─────────────────────────────────────────

async function fetchPlatformQuotes(platform: string, addresses: string[]): Promise<Map<string, CoinGeckoQuote>> {
  const uniqueAddresses = [...new Set(addresses.map((address) => normalizeContractAddress(platform, address)))];
  const quoteMap = new Map<string, CoinGeckoQuote>();

  const batches: string[][] = [];
  for (let index = 0; index < uniqueAddresses.length; index += COINGECKO_BATCH_SIZE) {
    batches.push(uniqueAddresses.slice(index, index + COINGECKO_BATCH_SIZE));
  }

  await Promise.allSettled(batches.map(async (batch) => {
    const params = new URLSearchParams({
      contract_addresses: batch.join(","),
      vs_currencies: "usd",
      include_24hr_change: "true",
    });

    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), COINGECKO_TIMEOUT_MS);

    try {
      const res = await fetch(`${COINGECKO_API_BASE}/simple/token_price/${platform}?${params.toString()}`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 15 },
        signal: ctrl.signal,
      });
      if (!res.ok) return;

      const json = await res.json() as Record<string, CoinGeckoQuote>;
      for (const [address, quote] of Object.entries(json)) {
        if ((quote.usd ?? 0) <= 0) continue;
        quoteMap.set(buildQuoteKey(platform, address), quote);
      }
    } catch {
      return;
    } finally {
      clearTimeout(timeoutId);
    }
  }));

  return quoteMap;
}

async function fetchCoinGeckoQuotes(positions: NormalizedPosition[]): Promise<Map<string, CoinGeckoQuote>> {
  const addressesByPlatform = new Map<string, string[]>();
  for (const position of positions) {
    const platform = platformFor(position.chainSlug);
    if (!platform) continue;
    const existing = addressesByPlatform.get(platform) ?? [];
    existing.push(position.contractAddress);
    addressesByPlatform.set(platform, existing);
  }

  const quoteMap = new Map<string, CoinGeckoQuote>();
  const platformQuotes = await Promise.all(
    [...addressesByPlatform.entries()].map(([platform, addresses]) => fetchPlatformQuotes(platform, addresses)),
  );
  for (const quotes of platformQuotes) {
    for (const [key, quote] of quotes.entries()) quoteMap.set(key, quote);
  }
  return quoteMap;
}

// ─── Public entry ─────────────────────────────────────────────────

export async function enrichPositionsWithLivePrices(positions: NormalizedPosition[]): Promise<NormalizedPosition[]> {
  // 1) DefiLlama primary — prices natives + tokens.
  const llamaKeyByIndex = positions.map((position) => llamaKeyFor(position));
  const llamaKeys = llamaKeyByIndex.filter((key): key is string => Boolean(key));
  const llamaPrices = llamaKeys.length > 0 ? await fetchLlamaPrices(llamaKeys) : new Map<string, number>();

  // 2) CoinGecko fallback — only for tokens DefiLlama did not price.
  const fallbackPositions = positions.filter((position, index) => {
    const key = llamaKeyByIndex[index];
    const hasLlama = key !== undefined && llamaPrices.has(key);
    return !hasLlama && isEligiblePosition(position);
  });
  const coinGeckoQuotes = fallbackPositions.length > 0
    ? await fetchCoinGeckoQuotes(fallbackPositions)
    : new Map<string, CoinGeckoQuote>();

  if (llamaPrices.size === 0 && coinGeckoQuotes.size === 0) return positions;

  // 3) Apply: prefer DefiLlama price, else CoinGecko. Recompute usdValue from balance.
  return positions.map((position, index) => {
    const llamaKey = llamaKeyByIndex[index];
    const llamaPrice = llamaKey !== undefined ? llamaPrices.get(llamaKey) : undefined;
    if (llamaPrice && llamaPrice > 0) {
      return {
        ...position,
        price: llamaPrice,
        priceAvailable: true,
        usdValue: position.balance > 0 ? position.balance * llamaPrice : 0,
        // DefiLlama current price carries no 24h change — keep the provider's.
      };
    }

    const platform = platformFor(position.chainSlug);
    const quote = platform && isEligiblePosition(position)
      ? coinGeckoQuotes.get(buildQuoteKey(platform, position.contractAddress))
      : undefined;
    const coinGeckoPrice = quote?.usd;
    if (coinGeckoPrice && coinGeckoPrice > 0) {
      return {
        ...position,
        price: coinGeckoPrice,
        priceAvailable: true,
        usdValue: position.balance > 0 ? position.balance * coinGeckoPrice : 0,
        priceChange24h: typeof quote?.usd_24h_change === "number"
          ? quote.usd_24h_change
          : position.priceChange24h,
      };
    }

    return position;
  });
}
