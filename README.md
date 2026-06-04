# Folio v3 — Complete EVM + DeFi Portfolio Tracker

Track any EVM wallet address — tokens, DeFi positions, lending, staking, rewards — across 30+ chains. Powered by Zerion.

---

## Quick Start

```bash
# 1. Install
npm install

# 2. Get Zerion API key (free) at https://developers.zerion.io

# 3. Configure
cat > .env.local << 'ENV'
ZERION_API_KEY=your_zerion_key_here
HELIUS_API_KEY=your_helius_key_here
ENV

# 4. Run
npm run dev
```

Open http://localhost:3000, paste any EVM address.

---

## What's new in v3

| Feature | v2 | v3 |
|---|---|---|
| Data source | CoinGecko + public RPCs | **Zerion API** |
| DeFi positions | None | **Full DeFi: deposit, borrow, reward, staked, locked** |
| Chain support | 26 static | **30+ dynamic from Zerion** |
| Token aggregation | CoinGecko ID | **Zerion fungible ID (more accurate)** |
| Borrow tracking | None | **Tracked separately as liabilities** |
| Prices | CoinGecko | **Zerion (live, per-position)** |
| Dependencies | React RC, old Next | **React 19 stable, Next 15.1** |

---

## Primary Provider: Zerion

**Why Zerion?**

Zerion is the most complete normalized EVM portfolio provider available:

- Returns wallet tokens AND DeFi positions in a single paginated API call
- Covers 30+ EVM chains — chain support grows automatically as Zerion adds more
- Uses a canonical `fungible_id` system (e.g. `"eth"`, `"usd-coin"`) that makes cross-chain token aggregation accurate without symbol collision risk
- Provides live USD prices, 24h changes, and spam filtering per position
- Explicitly identifies position types: `wallet`, `deposit`, `borrow`, `reward`, `staked`, `locked`

**Free tier:** Available at https://developers.zerion.io. Rate limited to ~5 req/sec.

**Constraints:**
- Requires `ZERION_API_KEY` — the app will return a clear error if missing
- Large wallets with many positions use pagination (capped at 10 pages to prevent quota exhaustion)
- HyperEVM and very new chains may not yet be supported by Zerion — the app degrades gracefully

---

## Chain Coverage

Chain support is **dynamic** — loaded from Zerion's `/chains/` API at startup and cached for 1 hour. This means:

- As Zerion adds new EVM chains, they automatically appear in the app without code changes
- Static fallback metadata (colors, emojis) is provided for 25+ known chains
- Unknown chains get a generic grey icon and still display correctly

Currently supported chains include:
Ethereum, Arbitrum, Optimism, Base, Blast, Linea, Scroll, zkSync Era, Mode, Polygon, BNB Chain, opBNB, Mantle, Avalanche, Fantom, Gnosis, Celo, Moonbeam, Moonriver, Aurora, Metis, Cronos, Kava, Boba, Core, Harmony, and more.

---

## DeFi Position Normalization

Each Zerion position has a `position_type`:

| Type | What it means | Included in totals? |
|---|---|---|
| `wallet` | Plain token in wallet | ✅ Yes |
| `deposit` | Supplied to lending/vault (e.g. Aave, Morpho) | ✅ Yes |
| `reward` | Claimable reward token | ✅ Yes |
| `staked` | Staked in a contract (e.g. stETH, sfrxETH) | ✅ Yes |
| `locked` | Vesting / time-locked | ✅ Yes |
| `borrow` | Borrowed from a protocol | ❌ No — tracked as liability |

**Borrow positions** are always excluded from portfolio totals and aggregations. They are displayed in the DeFi section under "Borrowed (Liability)".

---

## Token Aggregation

Tokens are grouped using **Zerion's `fungible_id`** as the canonical identity.

| Grouping key | Rule |
|---|---|
| `fungible:{id}` | Zerion fungible ID — most trustworthy |
| `stable:{SYMBOL}` | Known stablecoin by symbol (fallback) |
| `isolated:{chain}:{address}` | Unknown token — kept per-chain to prevent wrong merges |

**Example:** ETH on Ethereum (wallet), ETH on Arbitrum (wallet), ETH deposited in Morpho on Base — all share Zerion fungible ID `"eth"` → combined into one `AggregatedHolding` with total balance `0.30`.

**Note:** stETH ≠ ETH. Zerion assigns `"lido-staked-eth"` to stETH, so it is correctly tracked separately from ETH.

---

## What's included vs excluded from totals

### Total portfolio value includes:
- Wallet token balances
- DeFi deposits (Aave, Morpho, Compound, etc.)
- Claimable rewards
- Staked positions (stETH, rETH, etc.)
- Locked / vesting positions

### Explicitly excluded:
- Borrow positions (liabilities) — shown separately with negative indicator
- Spam tokens (Zerion `is_spam` flag)
- Unverified tokens with $0 value
- Positions with `displayable: false` and value < $0.01

---

## Architecture

```
app/api/portfolio/[address]/route.ts
  ↓
lib/providers/zerion.ts          ← Zerion API adapter (paginated)
  ↓
lib/chains/registry.ts           ← Dynamic chain registry from Zerion /chains/
  ↓
lib/normalize/positions.ts       ← ZerionPosition → NormalizedPosition[]
lib/normalize/protocols.ts       ← NormalizedPosition[] → ProtocolPosition[]
  ↓
lib/aggregate/holdings.ts        ← NormalizedPosition[] → AggregatedHolding[]
lib/aggregate/portfolio.ts       ← Full Portfolio build + calcTargetPrice()
  ↓
hooks/usePortfolio.ts            ← React Query, 30s stale, 60s auto-refresh
  ↓
components/Dashboard.tsx         ← Layout orchestrator
  ├── SummaryCards                ← Wallet + DeFi + borrow totals
  ├── ProtocolPositions           ← DeFi protocol cards (expandable)
  ├── HoldingsTable               ← Aggregated / wallet / defi views
  ├── ChainBreakdown              ← Donut + allocation bars
  ├── TopHoldings                 ← Bar chart + top 8 aggregated
  └── TargetPriceCalculator       ← Cross-chain + cross-protocol totals
```

---

## Deployment

```bash
# Vercel: push to GitHub, import at vercel.com/new
# Set one env var:
ZERION_API_KEY=your_zerion_key_here
ETHERSCAN_API_KEY=your_etherscan_key_here
HELIUS_API_KEY=your_helius_key_here   # Get free at https://dashboard.helius.dev/signup
```

---

## Dependencies (v3 stable)

| Package | Version | Notes |
|---|---|---|
| next | 15.1.3 | Stable |
| react | ^19.0.0 | Stable (was RC in v2) |
| react-dom | ^19.0.0 | Stable |
| @types/react | ^19.0.2 | Matches React 19 |
| @tanstack/react-query | ^5.62.7 | Latest stable |
| recharts | ^2.15.0 | Latest stable |

---

## Solana Support

Paste any Solana base58 wallet address — the app auto-detects it and routes to the Solana provider.

### What's tracked
| Feature | Status |
|---|---|
| Native SOL balance | ✅ |
| SPL token balances + prices | ✅ |
| Native SOL staking (all validators) | ✅ |
| DeFi protocols (Marinade, Jito, Raydium, Orca, Solend, Marginfi, Drift, etc.) | ✅ via Jupiter + free fallbacks |
| Perps (Drift, Zeta) | 🔜 |
| Transaction history | 🔜 |

### Provider: Helius DAS API
- **Free tier**: 1M credits/month — no credit card required
- **Sign up**: https://dashboard.helius.dev/signup
- **Add to `.env.local`**: `HELIUS_API_KEY=your_key_here`

### Optional Solana DeFi providers
- **Jupiter Portfolio API**: free key at https://portal.jup.ag
- **Mobula API**: free tier at https://mobula.io
- The app now prefers: Helius native staking → Jupiter → free on-chain adapters → Mobula

### Address format
- EVM: `0x...` (42 chars hex) — routed to Zerion
- Solana: base58 (32–44 chars) — routed to Helius
- Both can be tracked simultaneously using the multi-wallet bar

---

## Optional Perp History Auth

The isolated `GET /api/perp-history/[address]` lane supports extra auth-backed discovery without touching the live dashboard build.

### Paradex
- Add `PARADEX_EVM_ADDRESS` and `PARADEX_READONLY_TOKEN`
- The route will use Paradex readonly GET endpoints to load current account state, balances, open positions, fills, and orders for that specific wallet only
- Official auth docs: https://docs.paradex.trade/docs/trading/api-authentication

### Lighter
- Add `LIGHTER_EVM_ADDRESS`, `LIGHTER_READONLY_TOKEN`, and ideally `LIGHTER_ACCOUNT_INDEX`
- The route will use the wallet-linked account index plus Lighter read-only auth to load stronger account/trades data for that specific wallet
- Without auth, the route falls back to public wallet lookup and explorer endpoints only
- Official docs: https://apidocs.lighter.xyz/docs/api-keys

### Extended
- Add `EXTENDED_EVM_ADDRESS`, `EXTENDED_API_KEY`, `EXTENDED_PUBLIC_KEY`, `EXTENDED_PRIVATE_KEY`, and `EXTENDED_VAULT`
- `EXTENDED_API_BASE_URL` defaults to `https://api.starknet.extended.exchange`
- `EXTENDED_CLIENT_ID` can also be stored if you have it, but the current isolated adapter does not require it for read-only history
- The isolated `perp-history` lane now uses Extended private read-only GET endpoints for the configured sub-account only. Stark signing is still reserved for future write flows, and wallet-wide forensics may require scanning multiple Extended sub-accounts separately
- If you need the legacy StarkEx instance, you can override `EXTENDED_API_BASE_URL=https://api.extended.exchange`
- Official docs: https://docs.extended.exchange/
- Official org: https://github.com/x10xchange
