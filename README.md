# WalletFolio

**Multi-chain portfolio intelligence — read-only, non-custodial.**

Paste any wallet address (EVM or Solana) and see its holdings, DeFi positions, perps,
NFTs, P&L, yield opportunities, and risk across every chain — in one premium dashboard.
No wallet connection. No signatures. No keys.

**🔗 Live demo: https://folio-azure-pi.vercel.app**

---

## ✨ Try it (demo wallets)

There are **no accounts** — WalletFolio only reads public on-chain data, so anyone can
try it instantly. Open the **[live demo](https://folio-azure-pi.vercel.app)** (or run it
locally, below), then on the landing page paste an address or click a demo:

| Demo | Address |
|------|---------|
| `vitalik.eth` | `0xd8da6bf26964af9d7eed9e03e53415d37aa96045` |
| Active DeFi/HL wallet | `0xbc32be4d2c70239b59435a5963e5024637fa193e` |

The dashboard opens directly on the address you enter.

---

## Features

- **Multi-chain holdings** — every token across EVM, Solana and Hyperliquid, auto-detected
- **DeFi positions** — lending, LPs, staking and rewards, valued live
- **Perps & funding** — leverage, liquidation distance and live funding APR (Hyperliquid)
- **P&L & cost basis** — realized/unrealized P&L from on-chain activity (FIFO) + CSV export
- **Historical chart** — real portfolio value over time, benchmarked vs BTC & ETH
- **Yield opportunities** — best low-risk APY pools matched to the assets you hold
- **Approvals scanner** — find unlimited token allowances and revoke risky spenders
- **NFT gallery** — verified collections with estimated floor value
- **Market context** — Fear & Greed, BTC dominance, global market cap, gas, trending tokens
- **Stablecoin depeg monitor**, **ENS name/avatar**, **shareable portfolio card**, **⌘K command palette**

---

## Quick start

**Requirements:** Node 18+ and npm.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
#    then open .env.local and fill in your API keys (see below)

# 3. Run the dev server
npm run dev
```

Open **http://localhost:3000**, scroll past the intro, and paste a wallet address
(or click a demo wallet) to load its portfolio.

---

## Environment variables

Copy `.env.example` → `.env.local` and fill in keys. The only **required** key is Zerion;
everything else is optional and enables additional data.

| Variable | Required | Free source | Purpose |
|---|---|---|---|
| `ZERION_API_KEY` | ✅ | [developers.zerion.io](https://developers.zerion.io) | Core multi-chain holdings & DeFi |
| `HELIUS_API_KEY` | optional | [helius.dev](https://dashboard.helius.dev/signup) | Solana balances & history |
| `ETHERSCAN_API_KEY` | optional | [etherscan.io](https://etherscan.io) | EVM history & gas oracle |
| `OPENSEA_API_KEY` | optional | [docs.opensea.io](https://docs.opensea.io/reference/api-keys) | NFT floor data (auto free-tier key if absent) |
| `MORALIS_API_KEY`, `ZAPPER_API_KEY`, `COVALENT_API_KEY` | optional | respective sites | Fallback portfolio providers |

These free, **no-key** sources are used automatically (no setup):
DefiLlama (yields), Hyperliquid (perps/funding), GoPlus (approvals), Binance (benchmark),
CoinGecko / CoinPaprika / alternative.me (market context), ensideas (ENS).

> **Never commit `.env.local`** — it's gitignored. For deployment, set the same variables
> in your host's environment settings (e.g. Vercel → Project → Settings → Environment Variables).

---

## Scripts

```bash
npm run dev         # start the dev server (http://localhost:3000)
npm run build       # production build
npm run start       # run the production build
npm run type-check  # TypeScript check
npm test            # run tests
```

---

## Tech stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript**
- **Tailwind CSS** · **Recharts** · **Framer Motion** · **Lucide icons**
- **TanStack Query** for data fetching/caching

---

## Privacy & safety

WalletFolio is **read-only and non-custodial**. It never asks you to connect a wallet,
sign a message, or share a private key — it only reads public blockchain data for the
address you enter. Track your own wallets or any address you're curious about.

---

## Credits & data providers

Built with the help of these services and tools — thank you to all of them:

- **[Zerion](https://zerion.io)** — primary multi-chain portfolio & positions data
- **Zapper · Moralis** — portfolio fallback providers
- **[DefiLlama](https://defillama.com)** — live token prices, native-asset pricing & yields
- **[Hyperliquid](https://hyperliquid.xyz)** — perps, spot, funding & the real-time price stream
- **CoinGecko** — trending coins & the early-trend market scanner
- **Etherscan · Helius · Mobula** — EVM history & Solana data
- **GoPlus** — token-approval risk scanning
- **OpenRouter · OpenAI · Anthropic · MiniMax · Ollama** — optional bring-your-own-key AI assistant
- Built with **Codex** and **Claude** as AI pair-programmers

---

## License

MIT
