"use client";

import {
  Activity, BarChart3, Briefcase, Image as ImageIcon, Layers,
  LineChart, ShieldCheck, Sprout, Sparkles,
} from "lucide-react";
import { AddressInput } from "@/components/AddressInput";
import { MarketContextBar } from "@/components/dashboard/MarketContextBar";
import { TrendingTokens } from "@/components/dashboard/TrendingTokens";

const FEATURES: { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; title: string; desc: string }[] = [
  { icon: Briefcase, title: "Multi-chain holdings", desc: "Every token across EVM, Solana & Hyperliquid" },
  { icon: Layers, title: "DeFi positions", desc: "Lending, LPs, staking & rewards" },
  { icon: Activity, title: "Perps & funding", desc: "Leverage, liquidation distance, funding APR" },
  { icon: LineChart, title: "P&L & cost basis", desc: "Realized/unrealized from your activity" },
  { icon: Sprout, title: "Yield opportunities", desc: "Best low-risk APY for your assets" },
  { icon: ShieldCheck, title: "Approvals & risk", desc: "Spot unlimited allowances & revoke" },
  { icon: BarChart3, title: "Historical charts", desc: "Real value history vs BTC & ETH" },
  { icon: ImageIcon, title: "NFT gallery", desc: "Verified collections with floor value" },
];

const DEMOS: { label: string; address: string }[] = [
  { label: "vitalik.eth", address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045" },
  { label: "Sample wallet", address: "0xbc32be4d2c70239b59435a5963e5024637fa193e" },
];

export function WelcomeEmptyState({
  onSubmit,
  isLoading = false,
}: {
  onSubmit: (address: string) => void;
  isLoading?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-[14px] border border-border bg-surface-raised text-accent">
          <Sparkles className="h-5 w-5" strokeWidth={1.8} />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-text-hi">Track any wallet, like a pro</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-text-mid">
          Paste an address to see holdings, DeFi, perps, NFTs, P&amp;L, yields, and risk across every
          chain — in one premium, read-only dashboard.
        </p>
      </div>

      {/* Address input */}
      <div className="mx-auto mt-6 max-w-xl rounded-[12px] border border-border bg-surface p-4 shadow-card">
        <AddressInput onSubmit={onSubmit} isLoading={isLoading} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-text-lo">Try a demo:</span>
          {DEMOS.map((d) => (
            <button
              key={d.address}
              type="button"
              onClick={() => onSubmit(d.address)}
              className="rounded-full border border-border bg-surface-raised px-3 py-1 text-xs text-text-mid transition-colors hover:border-accent/40 hover:text-accent"
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feature grid */}
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-[12px] border border-border bg-surface p-4 shadow-card">
            <f.icon className="h-4.5 w-4.5 text-accent" strokeWidth={1.8} />
            <p className="mt-2.5 text-sm font-medium text-text-hi">{f.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-text-lo">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Live ambient market data so the page never feels empty */}
      <div className="mt-8 space-y-4">
        <MarketContextBar />
        <TrendingTokens />
      </div>
    </div>
  );
}
