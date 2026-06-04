/**
 * lib/providers/bitquery.ts
 *
 * BitQuery GraphQL API — SUPPLEMENTAL provider for DeFi positions.
 *
 * Why this exists:
 * Zerion may not fully cover certain protocols on Solana (Jupiter, Raydium,
 * Marinade, Jito) or newer chains. BitQuery provides broad DeFi coverage
 * via GraphQL with a generous free tier.
 *
 * Zerion remains PRIMARY. BitQuery data is used as fallback/supplemental.
 * BitQuery covers:
 *   - Solana: Jupiter swaps, Raydium liquidity, Marinade staking, Jito staking
 *   - EVM: Enhanced DeFi positions on chains Zerion covers thin
 *
 * API: https://graphql.bitquery.io (GraphQL)
 * Docs: https://docs.bitquery.io/
 * Free tier: 100 credits/day, 10 credits/query
 */

const BITQUERY_ENDPOINT = "https://graphql.bitquery.io";

export interface BitQueryConfig {
  apiKey: string;
}

// ─── Solana types ─────────────────────────────────────────────────

export interface BitQuerySolanaBalance {
  address: string;
  balance: number;
  token: {
    symbol: string;
    name: string;
    decimals: number;
    priceUsd?: number;
    mintAddress: string;
  };
}

export interface BitQuerySolanaDefiPosition {
  protocol: string;
  protocolSlug: string;
  account: string;
  type: "stake" | "lp" | "swap" | "farm" | "bridge";
  token: {
    symbol: string;
    name: string;
    decimals: number;
    mintAddress: string;
    priceUsd?: number;
  };
  amount: string; // raw amount as string
  amountUsd?: number;
  rewards?: Array<{
    symbol: string;
    amount: string;
    amountUsd?: number;
  }>;
  poolAddress?: string;
  chain: "solana";
}

export interface BitQuerySolanaData {
  address: string;
  balances: BitQuerySolanaBalance[];
  defiPositions: BitQuerySolanaDefiPosition[];
}

// ─── EVM types ────────────────────────────────────────────────────

export interface BitQueryEvmDefiPosition {
  protocol: string;
  protocolSlug: string;
  chainId: number;
  account: string;
  type: "deposit" | "borrow" | "stake" | "lp" | "farm" | "reward";
  token: {
    symbol: string;
    name: string;
    decimals: number;
    contractAddress: string;
    priceUsd?: number;
  };
  amount: string; // raw amount as string
  amountUsd?: number;
  poolAddress?: string;
}

export interface BitQueryEvmData {
  address: string;
  positions: BitQueryEvmDefiPosition[];
}

// ─── Solana GraphQL queries ──────────────────────────────────────

const SOLANA_BALANCES_QUERY = `
  query SolanaWalletBalances($address: String!) {
    Solana {
      BalanceUpdates(
        where: { Account: { is: $address } }
      ) {
        BalanceUpdate {
          Account
          Balance
          Currency {
            Symbol
            Name
            Decimals
            MintAddress
            Price(Currency: { is: "USD" })
          }
        }
      }
    }
  }
`;

const SOLANA_DEFI_QUERY = `
  query SolanaDeFiPositions($address: String!) {
    Solana {
      Instructions(
        where: {
          Transaction: { Result: { Success: true } }
          OR: [
            { Program: { is: "Marinade finance staking program" } }
            { Program: { is: "Jito staking program" } }
            { Program: { is: "Raydium liquidity program V4" } }
            { Program: { is: "Jupiter swap program" } }
          ]
        }
        limit: { count: 100}
      ) {
        Transaction {
          Hash
        }
        Block {
          Time
        }
        Instruction {
          Program
          Method
          Addresses
        }
      }
    }
  }
`;

// ─── Solana: Marinade staking ────────────────────────────────────

const MARINADE_STAKE_QUERY = `
  query MarinadeStake($address: String!) {
    Solana {
      BalanceUpdates(
        where: {
          Account: { is: $address }
          Currency: { MintAddress: { in: ["Marina2UVoSL9zkJ7QWk5tmC2DyKk1B9NG3f1FPsjD5"] } }
        }
      ) {
        BalanceUpdate {
          Account
          Balance
          Currency {
            Symbol
            Name
            Decimals
            MintAddress
            Price(Currency: { is: "USD" })
          }
        }
      }
      StakeUpdates(
        where: {
          Account: { is: $address }
        }
      ) {
        StakeUpdate {
          Account
          Active
          Balance
          Validator {
            Identity
          }
        }
      }
    }
  }
`;

// ─── Solana: Raydium liquidity ────────────────────────────────────

const RAYDIUM_LP_QUERY = `
  query RaydiumLP($address: String!) {
    Solana {
      LPBalanceUpdates(
        where: {
          Account: { is: $address }
        }
      ) {
        LPBalanceUpdate {
          Account
          Pool {
            Address
            Name
            Coin { Symbol Name Decimals MintAddress }
            QuoteCoin { Symbol Name Decimals MintAddress }
          }
          Balance
          Price(Currency: { is: "USD" })
        }
      }
    }
  }
`;

// ─── Solana: Jupiter swap ─────────────────────────────────────────

const JUPITER_SWAP_QUERY = `
  query JupiterSwaps($address: String!) {
    Solana {
      Transfers(
        where: {
          Transfer: { To: { is: $address } }
          Currency: { MintAddress: { not: "So11111111111111111111111111111111111111112" } }
        }
        order: { desc: Block_Time }
        limit: { count: 50 }
      ) {
        Transfer {
          From
          To
          Amount
          Currency {
            Symbol
            Name
            Decimals
            MintAddress
            Price(Currency: { is: "USD" })
          }
        }
        Block {
          Time
        }
        Transaction {
          Hash
        }
      }
    }
  }
`;

// ─── EVM: Generic DeFi positions ─────────────────────────────────

const EVM_DEFI_QUERY = `
  query EvmDefiPositions($chainId: Int!, $address: String!) {
    EVM(dataset: combined, network: { eth: $chainId }) {
      BalanceUpdates(
        where: { Address: { is: $address } }
      ) {
        Currency {
          Symbol
          Name
          Contract
          Decimals
          FungibleType
        }
        BalanceUpdate {
          Address
          Balance
          BalanceUSD
        }
      }
      Transfers(
        where: {
          TransactionStatus: { is: 1 }
          OR: [
            { TransferTo: { is: $address } }
            { TransferFrom: { is: $address } }
          ]
        }
      ) {
        Transfer {
          Amount
          Currency {
            Symbol
            Name
            Contract
            Decimals
          }
          PriceUSD
        }
        Block {
          Time
        }
        Transaction {
          Hash
        }
      }
    }
  }
`;

// ─── Fetch helpers ────────────────────────────────────────────────

async function bitqueryQuery<T>(
  query: string,
  variables: Record<string, unknown>,
  apiKey: string
): Promise<T | null> {
  try {
    const res = await fetch(BITQUERY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(15_000),
      // @ts-ignore - Next.js extends RequestInit with `next`
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      console.warn(`[bitquery] HTTP ${res.status}`);
      return null;
    }

    const body: { data?: T; errors?: Array<{ message: string }> } = await res.json();

    if (body.errors?.length) {
      console.debug(`[bitquery] query error: ${body.errors[0].message}`);
      return null;
    }

    return body.data ?? null;
  } catch (err) {
    console.warn(`[bitquery] fetch failed:`, err);
    return null;
  }
}

// ─── Solana position fetchers ─────────────────────────────────────

export async function fetchBitQuerySolanaBalances(
  address: string,
  apiKey: string
): Promise<BitQuerySolanaBalance[]> {
  const data = await bitqueryQuery<{
    Solana?: { BalanceUpdates?: Array<{ BalanceUpdate: BitQuerySolanaBalance }> };
  }>(SOLANA_BALANCES_QUERY, { address }, apiKey);

  return data?.Solana?.BalanceUpdates?.map((b) => b.BalanceUpdate) ?? [];
}

export async function fetchBitQueryMarinadeStake(
  address: string,
  apiKey: string
): Promise<BitQuerySolanaDefiPosition[]> {
  const data = await bitqueryQuery<{
    Solana?: {
      BalanceUpdates?: Array<{ BalanceUpdate: { Account: string; Balance: number; Currency: BitQuerySolanaBalance["token"] } }>;
      StakeUpdates?: Array<{ StakeUpdate: { Account: string; Active: boolean; Balance: number } }>;
    };
  }>(MARINADE_STAKE_QUERY, { address }, apiKey);

  const positions: BitQuerySolanaDefiPosition[] = [];

  // Marinade stake accounts
  const stakeUpdates = data?.Solana?.StakeUpdates ?? [];
  for (const su of stakeUpdates) {
    if ((su.StakeUpdate?.Balance ?? 0) > 0) {
      positions.push({
        protocol: "Marinade Finance",
        protocolSlug: "marinade",
        account: address,
        type: "stake",
        token: {
          symbol: "MNDE",
          name: "Marinade Finance",
          decimals: 9,
          mintAddress: su.StakeUpdate?.Account ?? "",
        },
        amount: String(su.StakeUpdate?.Balance ?? 0),
        amountUsd: undefined,
        chain: "solana",
      });
    }
  }

  return positions;
}

export async function fetchBitQueryRaydiumLP(
  address: string,
  apiKey: string
): Promise<BitQuerySolanaDefiPosition[]> {
  const data = await bitqueryQuery<{
    Solana?: {
      LPBalanceUpdates?: Array<{
        LPBalanceUpdate: {
          Account: string;
          Balance: number;
          Pool: {
            Address: string;
            Name: string;
            Coin: { Symbol: string; Name: string; Decimals: number; MintAddress: string };
            QuoteCoin: { Symbol: string; Name: string; Decimals: number; MintAddress: string };
          };
        };
      }>;
    };
  }>(RAYDIUM_LP_QUERY, { address }, apiKey);

  const updates = data?.Solana?.LPBalanceUpdates ?? [];
  return updates.map((u) => ({
    protocol: "Raydium",
    protocolSlug: "raydium",
    account: address,
    type: "lp" as const,
    token: {
      symbol: `${u.LPBalanceUpdate.Pool.Coin.Symbol}-${u.LPBalanceUpdate.Pool.QuoteCoin.Symbol}`,
      name: u.LPBalanceUpdate.Pool.Name,
      decimals: u.LPBalanceUpdate.Pool.Coin.Decimals,
      mintAddress: u.LPBalanceUpdate.Pool.Address,
    },
    amount: String(u.LPBalanceUpdate?.Balance ?? 0),
    amountUsd: undefined,
    poolAddress: u.LPBalanceUpdate.Pool.Address,
    chain: "solana" as const,
  }));
}

// ─── Main fetch function for Solana ───────────────────────────────

export async function fetchBitQuerySolanaData(
  address: string,
  apiKey: string
): Promise<BitQuerySolanaData> {
  const [balances, marinadePositions, raydiumPositions] = await Promise.allSettled([
    fetchBitQuerySolanaBalances(address, apiKey),
    fetchBitQueryMarinadeStake(address, apiKey),
    fetchBitQueryRaydiumLP(address, apiKey),
  ]);

  const allDefiPositions: BitQuerySolanaDefiPosition[] = [
    ...(marinadePositions.status === "fulfilled" ? marinadePositions.value : []),
    ...(raydiumPositions.status === "fulfilled" ? raydiumPositions.value : []),
  ];

  return {
    address,
    balances: balances.status === "fulfilled" ? balances.value : [],
    defiPositions: allDefiPositions,
  };
}

// ─── EVM generic fetcher ─────────────────────────────────────────

const EVM_CHAIN_IDS = [1, 42161, 10, 137, 8453, 43114]; // ETH, ARB, OP, MATIC, BASE, AVAX

export async function fetchBitQueryEvmPositions(
  address: string,
  apiKey: string
): Promise<BitQueryEvmDefiPosition[]> {
  const results = await Promise.allSettled(
    EVM_CHAIN_IDS.map((chainId) =>
      bitqueryQuery<{
        EVM?: {
          BalanceUpdates?: Array<{
            Currency: { Symbol: string; Name: string; Contract: string; Decimals: number };
            BalanceUpdate: { Address: string; Balance: string; BalanceUSD: number };
          }>;
        };
      }>(EVM_DEFI_QUERY, { chainId, address }, apiKey)
    )
  );

  const allPositions: BitQueryEvmDefiPosition[] = [];

  results.forEach((result, i) => {
    if (result.status !== "fulfilled" || !result.value?.EVM?.BalanceUpdates) return;
    const chainId = EVM_CHAIN_IDS[i];

    for (const bu of result.value.EVM!.BalanceUpdates!) {
      const bal = bu.BalanceUpdate;
      const currency = bu.Currency;
      if (!currency || !bal || parseFloat(bal.Balance) === 0) continue;

      allPositions.push({
        protocol: "Unknown",
        protocolSlug: "unknown",
        chainId,
        account: address,
        type: "deposit",
        token: {
          symbol: currency.Symbol,
          name: currency.Name,
          decimals: currency.Decimals,
          contractAddress: currency.Contract,
          priceUsd: bal.BalanceUSD / parseFloat(bal.Balance) || undefined,
        },
        amount: bal.Balance,
        amountUsd: bal.BalanceUSD,
      });
    }
  });

  return allPositions;
}
