import type { NormalizedPosition } from "@/types";

const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3";
const COINGECKO_TIMEOUT_MS = 1_800;
const COINGECKO_BATCH_SIZE = 80;

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

export async function enrichPositionsWithLivePrices(positions: NormalizedPosition[]): Promise<NormalizedPosition[]> {
  const eligible = positions.filter(isEligiblePosition);
  if (eligible.length === 0) return positions;

  const addressesByPlatform = new Map<string, string[]>();
  for (const position of eligible) {
    const platform = platformFor(position.chainSlug);
    if (!platform) continue;
    const existing = addressesByPlatform.get(platform) ?? [];
    existing.push(position.contractAddress);
    addressesByPlatform.set(platform, existing);
  }

  const quoteMap = new Map<string, CoinGeckoQuote>();
  const platformQuotes = await Promise.all(
    [...addressesByPlatform.entries()].map(async ([platform, addresses]) => {
      const quotes = await fetchPlatformQuotes(platform, addresses);
      return quotes;
    }),
  );

  for (const quotes of platformQuotes) {
    for (const [key, quote] of quotes.entries()) {
      quoteMap.set(key, quote);
    }
  }

  if (quoteMap.size === 0) return positions;

  return positions.map((position) => {
    const platform = platformFor(position.chainSlug);
    if (!platform || !isEligiblePosition(position)) return position;

    const quote = quoteMap.get(buildQuoteKey(platform, position.contractAddress));
    const livePrice = quote?.usd;
    if (!livePrice || livePrice <= 0) return position;

    return {
      ...position,
      price: livePrice,
      priceAvailable: true,
      usdValue: position.balance > 0 ? position.balance * livePrice : 0,
      priceChange24h: typeof quote?.usd_24h_change === "number"
        ? quote.usd_24h_change
        : position.priceChange24h,
    };
  });
}