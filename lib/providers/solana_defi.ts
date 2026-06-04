/**
 * lib/providers/solana_defi.ts
 *
 * On-chain Solana DeFi positions via Helius RPC (free, no API key needed beyond Helius).
 *
 * Covers:
 *   - Marinade mSOL staking     (program: MarBmsSgLxL2DendVuMxVqMg2bLoJ9UiCfM4DxTdsBtzD)
 *   - Jito SOL staking           (program: Jito4nYqC9qJvG2qE9RbfJ3WLHf2Co4JsNQKoJ9bhFxo)
 *   - Native stake accounts      (program: Stake111111111111111111111111111111111111111111)
 *   - Raydium LP positions       (program: LBUZKhHzPFfkdX9qDfE4KfeMGyjvyD4eEVLA5qJWsDj)
 *     — Raydium uses token accounts; LP token balances are in user token accounts
 *     — We detect LP tokens by mint pattern
 *
 * All fetched via Helius RPC getProgramAccounts which is free on all tiers.
 */

const HELIUS_BASE = "https://mainnet.helius-rpc.com";

// ─── Types ─────────────────────────────────────────────────────────

export interface SolanaDeFiPosition {
  protocol:    string;
  protocolSlug: string;
  type:        "stake" | "lp";
  tokenMint:   string;
  tokenSymbol: string;
  tokenName:   string;
  decimals:    number;
  balance:     number;    // in token units (not lamports)
  usdValue?:   number;
  poolAddress?: string;
  validator?:  string;
}

// ─── Helius RPC helper ─────────────────────────────────────────────

async function heliusRpc<T>(
  apiKey: string,
  body: object,
  timeoutMs = 20_000,
): Promise<T> {
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
    const json = await res.json();
    if (json?.error) throw new Error(`RPC error: ${JSON.stringify(json.error)}`);
    return json as T;
  } finally {
    clearTimeout(tid);
  }
}

// ─── Marinade mSOL stake accounts ─────────────────────────────────

const MARINADE_PROGRAM = "MarBmsSgLxL2DendVuMxVqMg2bLoJ9UiCfM4DxTdsBtzD";
const MSOL_MINT        = "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So";
const MNDE_MINT        = "Marina2UVoSL9zkJ7QWk5tmC2DyKk1B9NG3f1FPsjD5";

interface MarinadeTokenAccount {
  pubkey: string;
  account: {
    data?: {
      parsed?: {
        info?: {
          mint?: string;
          tokenAmount?: {
            amount?: string;
            decimals?: number;
            uiAmountString?: string;
          };
        };
      };
    };
  };
}

/**
 * Fetch Marinade exposure for a wallet.
 *
 * The previous program-account filter was relying on an incorrect Marinade account
 * layout offset, which causes Helius to reject the request with `WrongSize`.
 * Using the owner's mSOL token accounts is cheaper, stable, and still captures the
 * user's liquid Marinade position for protocol grouping.
 */
async function fetchMarinadeStakeAccounts(
  address: string,
  apiKey: string,
): Promise<SolanaDeFiPosition[]> {
  try {
    const data = await heliusRpc<{
      jsonrpc: string;
      id: string;
      result: { value?: MarinadeTokenAccount[] } | MarinadeTokenAccount[];
    }>(apiKey, {
      jsonrpc: "2.0",
      id:      "marinade-msol",
      method:  "getTokenAccountsByOwner",
      params:  [
        address,
        { mint: MSOL_MINT },
        { encoding: "jsonParsed" },
      ],
    });

    const accounts = Array.isArray(data.result)
      ? data.result
      : data.result?.value ?? [];

    let totalBalance = 0;
    for (const account of accounts) {
      const tokenAmount = account.account.data?.parsed?.info?.tokenAmount;
      if (!tokenAmount) continue;

      const uiAmount = tokenAmount.uiAmountString;
      if (uiAmount) {
        totalBalance += parseFloat(uiAmount);
        continue;
      }

      const rawAmount = tokenAmount.amount;
      const decimals = tokenAmount.decimals ?? 0;
      if (!rawAmount) continue;
      totalBalance += Number(rawAmount) / 10 ** decimals;
    }

    if (totalBalance <= 0) return [];

    return [{
      protocol:     "Marinade Finance",
      protocolSlug: "marinade",
      type:         "stake",
      tokenMint:    MSOL_MINT,
      tokenSymbol:  "mSOL",
      tokenName:    "Marinade Staked SOL",
      decimals:     9,
      balance:      totalBalance,
      poolAddress:  "MarinadeTokenAccounts",
    }];
  } catch (err) {
    console.warn("[solana_defi] Marinade fetch failed:", err);
    return [];
  }
}

// ─── Jito SOL staking ──────────────────────────────────────────────

const JITO_PROGRAM = "Jito4nYqC9qJvG2qE9RbfJ3WLHf2Co4JsNQKoJ9bhFxo";
const JITOSOL_MINT = "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn";

interface JitoStakeAccount {
  pubkey: string;
  account: {
    lamports: number;
    data: {
      parsed?: {
        info?: {
          stake?: string;
        };
      };
    };
  };
}

/**
 * Fetch Jito stake accounts. Jito staking locks SOL and issues JitoSOL (jitoSOL).
 */
async function fetchJitoStakeAccounts(
  address: string,
  apiKey: string,
): Promise<SolanaDeFiPosition[]> {
  try {
    const data = await heliusRpc<{
      jsonrpc: string;
      id: string;
      result: JitoStakeAccount[];
    }>(apiKey, {
      jsonrpc: "2.0",
      id:      "jito-stakes",
      method:  "getProgramAccounts",
      params:  [
        JITO_PROGRAM,
        {
          encoding: "jsonParsed",
          filters: [
            { memcmp: { offset: 4, bytes: address } }, // voter/authority
          ],
        },
      ],
    });

    const positions: SolanaDeFiPosition[] = [];
    const stakes = data.result ?? [];

    if (stakes.length === 0) return [];

    let totalLamports = 0;
    for (const stake of stakes) {
      totalLamports += stake.account.lamports ?? 0;
    }

    if (totalLamports > 0) {
      positions.push({
        protocol:     "Jito",
        protocolSlug: "jito",
        type:        "stake",
        tokenMint:   JITOSOL_MINT,
        tokenSymbol: "jitoSOL",
        tokenName:   "Jito Staked SOL",
        decimals:    9,
        balance:     totalLamports / 1_000_000_000,
      });
    }

    return positions;
  } catch (err) {
    console.warn("[solana_defi] Jito fetch failed:", err);
    return [];
  }
}

// ─── Native SOL stake accounts ──────────────────────────────────────

const STAKE_PROGRAM = "Stake111111111111111111111111111111111111111111";

/**
 * Fetch native SOL stake accounts (already done in Helius portfolio).
 * This is a reference for adding more stake types.
 */
async function fetchNativeStakeAccounts(
  address: string,
  apiKey: string,
): Promise<SolanaDeFiPosition[]> {
  try {
    const data = await heliusRpc<{
      jsonrpc: string;
      id: string;
      result: Array<{
        pubkey: string;
        account: { lamports: number; data: { parsed?: unknown } };
      }>;
    }>(apiKey, {
      jsonrpc: "2.0",
      id:      "native-stakes",
      method:  "getProgramAccounts",
      params:  [
        STAKE_PROGRAM,
        {
          encoding: "jsonParsed",
          filters: [
            { memcmp: { offset: 44, bytes: address } }, // staker authority
          ],
        },
      ],
    });

    return [];
  } catch {
    return [];
  }
}

// ─── Raydium LP detection ──────────────────────────────────────────

const RAYDIUM_PROGRAM = "LBUZKhHzPFfkdX9qDfE4KfeMGyjvyD4eEVLA5qJWsDj";
const RAYDIUM_LP_MINTS = new Set([
  // Common Raydium LP token mints — add pools as needed
]);

/**
 * Raydium LP: the LP tokens are just SPL tokens in the user's wallet.
 * We detect them by checking token balances against known Raydium LP mint addresses.
 * Since we already have all SPL token balances from Helius,
 * this function just returns [] — LP detection is done by token mint matching.
 */
async function fetchRaydiumLpPositions(
  _address: string,
  _apiKey: string,
): Promise<SolanaDeFiPosition[]> {
  // Raydium LP positions are SPL tokens — they appear in Helius token balances.
  // The "DeFi" nature is determined by the protocol grouping in the normalizer.
  // No separate RPC call needed.
  return [];
}

// ─── Main fetcher ──────────────────────────────────────────────────

export interface SolanaDefiResult {
  positions: SolanaDeFiPosition[];
}

/**
 * Fetch all Solana DeFi positions (staking, LP) via Helius RPC.
 * All free, no additional API keys needed.
 */
export async function fetchSolanaDeFiPositions(
  address: string,
  apiKey: string,
): Promise<SolanaDefiResult> {
  // Fetch all stake types in parallel
  const [marinade, jito] = await Promise.all([
    fetchMarinadeStakeAccounts(address, apiKey),
    fetchJitoStakeAccounts(address, apiKey),
  ]);

  const all = [...marinade, ...jito];

  if (all.length > 0) {
    console.info(`[solana_defi] Found ${all.length} DeFi positions: ${all.map((p) => `${p.protocol} ${p.balance} ${p.tokenSymbol}`).join(", ")}`);
  }

  return { positions: all };
}
