/**
 * lib/providers/solana.ts
 *
 * Solana portfolio provider using Helius DAS API (free tier).
 *
 * API key: Get free at https://dashboard.helius.dev/signup
 * Free tier: 1M credits/month, 10 req/sec — enough for personal use.
 *
 * Fetches:
 *  1. All fungible SPL tokens + native SOL balance  (getAssetsByOwner DAS)
 *  2. Native stake accounts                          (getStakeAccounts RPC)
 */

export interface HeliusAsset {
  id: string;
  content?: {
    metadata?: { name?: string; symbol?: string };
    links?: { image?: string };
    files?: Array<{ uri?: string; cdn_uri?: string }>;
  };
  token_info?: {
    symbol?: string;
    decimals?: number;
    balance?: number;
    price_info?: {
      price_per_token?: number;
      total_price?: number;
      currency?: string;
    };
  };
  interface?: string; // "FungibleToken" | "FungibleAsset" | "V1_NFT" | "ProgrammableNFT"
  ownership?: { owner?: string };
  nativeBalance?: { lamports?: number; price_per_sol?: number; total_price?: number };
}

export interface HeliusStakeAccount {
  address: string;
  lamports: number;
  data: {
    parsed?: {
      type?: string;
      info?: {
        stake?: {
          delegation?: {
            stake?: string;
            voter?: string;
            activationEpoch?: string;
            deactivationEpoch?: string;
          };
        };
        meta?: { rentExemptReserve?: string };
      };
    };
  };
}

export interface HeliusInflationReward {
  amount?: number;
  epoch?: number;
  effectiveSlot?: number;
  postBalance?: number;
  commission?: number;
}

export interface SolanaRawData {
  tokens:  HeliusAsset[];
  solAsset?: HeliusAsset;   // the item that carries nativeBalance
  stakeAccounts: HeliusStakeAccount[];
  currentEpoch?: number;
  inflationRewards?: Record<string, HeliusInflationReward>;
}

const HELIUS_BASE = "https://mainnet.helius-rpc.com";
const LAMPORTS_PER_SOL = 1_000_000_000;
const STAKE_PROGRAM_ID = "Stake11111111111111111111111111111111111111112";
const STAKE_AUTHORIZED_STAKER_OFFSET = 12;
const STAKE_AUTHORIZED_WITHDRAWER_OFFSET = 44;

interface HeliusStakeProgramAccount {
  pubkey: string;
  account?: {
    lamports?: number;
    data?: {
      parsed?: HeliusStakeAccount["data"]["parsed"];
    };
  };
}

async function heliusPost<T = unknown>(apiKey: string, body: object, timeoutMs = 15_000): Promise<T> {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${HELIUS_BASE}/?api-key=${apiKey}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
      signal:  ctrl.signal,
    });
    if (!res.ok) throw new Error(`Helius ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(tid);
  }
}

/** Fetch all fungible SPL tokens + native SOL balance via DAS getAssetsByOwner */
async function fetchAssets(address: string, apiKey: string): Promise<HeliusAsset[]> {
  const all: HeliusAsset[] = [];
  let page = 1;
  const limit = 1000;

  while (true) {
    const data = await heliusPost<{
      result?: {
        items?: HeliusAsset[];
        nativeBalance?: {
          lamports?: number;
          price_per_sol?: number;
          total_price?: number;
        };
      };
    }>(apiKey, {
      jsonrpc: "2.0",
      id:      "getAssetsByOwner",
      method:  "getAssetsByOwner",
      params: {
        ownerAddress: address,
        page,
        limit,
        displayOptions: {
          showFungible:      true,
          showNativeBalance: true,
          showZeroBalance:   false,
        },
        sortBy: { sortBy: "recent_action", sortDirection: "desc" },
      },
    });

    const items: HeliusAsset[] = data?.result?.items ?? [];
    all.push(...items);

    // nativeBalance is on result.nativeBalance as a top-level field for the first page
    // We inject it as a synthetic asset later in normalization
    if (page === 1 && data?.result?.nativeBalance) {
      // Attach native SOL as a synthetic item
      const nb = data.result.nativeBalance;
      all.push({
        id: "So11111111111111111111111111111111111111112",
        interface: "FungibleAsset",
        token_info: {
          symbol: "SOL",
          decimals: 9,
          balance: nb.lamports ?? 0,
          price_info: {
            price_per_token: nb.price_per_sol ?? 0,
            total_price: nb.total_price ?? 0,
          },
        },
        content: { metadata: { name: "Solana", symbol: "SOL" } },
        nativeBalance: nb,
      });
    }

    if (items.length < limit) break;
    page++;
    if (page > 5) break; // safety cap — 5000 assets max
  }

  return all;
}

async function fetchStakeAccountsByAuthorityOffset(
  address: string,
  apiKey: string,
  offset: number,
  label: string,
): Promise<HeliusStakeAccount[]> {
  const data = await heliusPost<{
    result?: HeliusStakeProgramAccount[];
  }>(apiKey, {
    jsonrpc: "2.0",
    id: `getStakeAccounts:${label}`,
    method: "getProgramAccounts",
    params: [
      STAKE_PROGRAM_ID,
      {
        encoding: "jsonParsed",
        filters: [
          { memcmp: { offset, bytes: address } },
        ],
      },
    ],
  });

  const accounts = (data?.result ?? []).map((account) => ({
    address: account.pubkey,
    lamports: account.account?.lamports ?? 0,
    data: {
      parsed: account.account?.data?.parsed,
    },
  }));

  if (accounts.length > 0) {
    console.info(`[solana] Native stake match via ${label}: ${accounts.length} accounts`);
  }

  return accounts;
}

/** Fetch native SOL stake accounts via RPC getProgramAccounts. */
async function fetchStakeAccounts(
  address: string,
  apiKey: string
): Promise<HeliusStakeAccount[]> {
  try {
    const [stakerMatches, withdrawerMatches] = await Promise.all([
      fetchStakeAccountsByAuthorityOffset(
        address,
        apiKey,
        STAKE_AUTHORIZED_STAKER_OFFSET,
        "staker",
      ).catch(() => []),
      fetchStakeAccountsByAuthorityOffset(
        address,
        apiKey,
        STAKE_AUTHORIZED_WITHDRAWER_OFFSET,
        "withdrawer",
      ).catch(() => []),
    ]);

    const deduped = new Map<string, HeliusStakeAccount>();
    for (const account of [...stakerMatches, ...withdrawerMatches]) {
      deduped.set(account.address, account);
    }

    return [...deduped.values()];
  } catch {
    return []; // non-fatal
  }
}

async function fetchCurrentEpoch(apiKey: string): Promise<number | undefined> {
  try {
    const data = await heliusPost<{
      result?: { epoch?: number };
    }>(apiKey, {
      jsonrpc: "2.0",
      id:      "getEpochInfo",
      method:  "getEpochInfo",
      params:  [],
    });

    return data?.result?.epoch;
  } catch {
    return undefined;
  }
}

async function fetchInflationRewards(
  stakeAddresses: string[],
  apiKey: string
): Promise<Record<string, HeliusInflationReward>> {
  if (stakeAddresses.length === 0) return {};

  try {
    const data = await heliusPost<{
      result?: Array<HeliusInflationReward | null>;
    }>(apiKey, {
      jsonrpc: "2.0",
      id:      "getInflationReward",
      method:  "getInflationReward",
      params:  [stakeAddresses],
    });

    const rewards = data?.result ?? [];
    return stakeAddresses.reduce<Record<string, HeliusInflationReward>>((acc, address, index) => {
      const reward = rewards[index];
      if (reward) acc[address] = reward;
      return acc;
    }, {});
  } catch {
    return {};
  }
}

export async function fetchSolanaPortfolio(
  address: string,
  apiKey: string
): Promise<SolanaRawData> {
  const [assets, stakeAccounts, currentEpoch] = await Promise.all([
    fetchAssets(address, apiKey),
    fetchStakeAccounts(address, apiKey),
    fetchCurrentEpoch(apiKey),
  ]);

  const inflationRewards = await fetchInflationRewards(
    stakeAccounts.map((account) => account.address),
    apiKey
  );

  // Separate native SOL synthetic asset from SPL tokens
  const solAsset = assets.find(
    (a) => a.id === "So11111111111111111111111111111111111111112" && a.nativeBalance
  );
  const tokens = assets.filter((a) =>
    // Keep fungible tokens only; skip NFTs; skip the synthetic SOL we already captured
    (a.interface === "FungibleToken" || a.interface === "FungibleAsset") &&
    !(a.id === "So11111111111111111111111111111111111111112" && a.nativeBalance)
  );

  return { tokens, solAsset, stakeAccounts, currentEpoch, inflationRewards };
}
