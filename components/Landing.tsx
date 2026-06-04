"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import {
  Activity, BarChart3, Briefcase, ChevronDown, Image as ImageIcon, Layers,
  LineChart, Lock, ShieldCheck, Sparkles, Sprout, Zap,
} from "lucide-react";
import { AddressInput } from "@/components/AddressInput";

const ScrollMorphHero = dynamic(
  () => import("@/components/ui/scroll-morph-hero").then((m) => m.default),
  { ssr: false, loading: () => <div className="min-h-[100dvh] bg-bg" /> }
);

const FEATURES = [
  { icon: Briefcase, title: "Multi-chain holdings", desc: "Every token across EVM, Solana & Hyperliquid — auto-detected." },
  { icon: Layers, title: "DeFi positions", desc: "Lending, LPs, staking and rewards, valued in real time." },
  { icon: Activity, title: "Perps & funding", desc: "Leverage, liquidation distance and live funding APR." },
  { icon: LineChart, title: "P&L & cost basis", desc: "Realized and unrealized P&L computed from your activity (FIFO)." },
  { icon: Sprout, title: "Yield opportunities", desc: "Best low-risk APY pools matched to the assets you hold." },
  { icon: ShieldCheck, title: "Approvals & risk", desc: "Find unlimited token allowances and revoke risky spenders." },
  { icon: BarChart3, title: "Historical charts", desc: "Real value history, benchmarked against BTC and ETH." },
  { icon: ImageIcon, title: "NFT gallery", desc: "Verified collections with estimated floor value." },
];

const STEPS = [
  { n: "01", title: "Paste an address", desc: "Any EVM (0x…) or Solana wallet. No connection, no signing — read-only." },
  { n: "02", title: "We aggregate everything", desc: "Holdings, DeFi, perps, NFTs and history pulled across every chain in seconds." },
  { n: "03", title: "Read it like a pro", desc: "Allocation, P&L, risk, yields and market context in one premium dashboard." },
];

const TRUST = ["Zerion", "Hyperliquid", "DefiLlama", "OpenSea", "GoPlus", "CoinGecko"];

const DEMOS: { label: string; address: string }[] = [
  { label: "vitalik.eth", address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045" },
  { label: "Sample wallet", address: "0xbc32be4d2c70239b59435a5963e5024637fa193e" },
];

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`mx-auto w-full max-w-6xl px-6 ${className}`}>{children}</section>;
}

export function Landing({ onEnter }: { onEnter: (address?: string) => void }) {
  const inputRef = useRef<HTMLDivElement>(null);
  const scrollToInput = () => inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

  return (
    <div className="relative bg-bg text-text-hi">
      {/* Hero (existing scroll-morph). "Enter" jumps to the address box. */}
      <div className="relative h-[100dvh]">
        <ScrollMorphHero onEnter={scrollToInput} />
        <button
          type="button"
          onClick={scrollToInput}
          className="absolute bottom-7 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-text-lo transition-colors hover:text-text-hi"
        >
          Start tracking
          <ChevronDown className="h-4 w-4 animate-bounce" />
        </button>
      </div>

      <div className="border-t border-border">
        {/* Hero value-prop + ADDRESS INPUT (primary entry) */}
        <Section className="py-24 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[11px] uppercase tracking-wide text-text-lo">
            <Sparkles className="h-3 w-3 text-accent" /> Multi-chain portfolio intelligence
          </span>
          <h2 className="mx-auto mt-5 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            The whole portfolio. Every chain. One read-only dashboard.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-text-mid">
            Paste any wallet address to see holdings, DeFi, perps, NFTs, P&amp;L, yields and risk —
            without connecting a wallet or signing anything.
          </p>

          {/* The single entry point */}
          <div ref={inputRef} className="mx-auto mt-8 max-w-xl scroll-mt-24 rounded-[14px] border border-border bg-surface p-4 shadow-card">
            <AddressInput onSubmit={(a) => onEnter(a)} />
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-text-lo">Try a demo:</span>
              {DEMOS.map((d) => (
                <button
                  key={d.address}
                  type="button"
                  onClick={() => onEnter(d.address)}
                  className="rounded-full border border-border bg-surface-raised px-3 py-1 text-xs text-text-mid transition-colors hover:border-accent/40 hover:text-accent"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-3 text-xs text-text-lo">Free · no account · no wallet connection</p>
        </Section>

        {/* Features grid */}
        <Section className="py-12">
          <div id="features" className="scroll-mt-20">
            <p className="text-[11px] font-medium uppercase tracking-wide text-accent">Features</p>
            <h3 className="mt-2 text-2xl font-semibold">Everything you&apos;d expect — and the parts others charge for</h3>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-[12px] border border-border bg-surface p-5 shadow-card transition-colors hover:border-border-strong">
                  <f.icon className="h-5 w-5 text-accent" strokeWidth={1.8} />
                  <p className="mt-3 text-sm font-semibold text-text-hi">{f.title}</p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-text-lo">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* How it works */}
        <Section className="py-20">
          <p className="text-[11px] font-medium uppercase tracking-wide text-accent">How it works</p>
          <h3 className="mt-2 text-2xl font-semibold">From address to insight in seconds</h3>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-[12px] border border-border bg-surface p-6 shadow-card">
                <span className="num text-3xl font-semibold text-accent/40">{s.n}</span>
                <p className="mt-3 text-base font-semibold text-text-hi">{s.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-text-mid">{s.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Trust / privacy */}
        <Section className="py-12">
          <div className="rounded-[16px] border border-border bg-surface p-8 shadow-card">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-center">
              <div>
                <div className="inline-flex items-center gap-2 text-success">
                  <Lock className="h-4 w-4" />
                  <span className="text-[11px] font-medium uppercase tracking-wide">Read-only · non-custodial</span>
                </div>
                <h3 className="mt-3 text-2xl font-semibold">No wallet connection. No signatures. No keys.</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-mid">
                  WalletFolio only reads public on-chain data. Nothing to approve, nothing at risk —
                  track your own wallets or any address you&apos;re curious about.
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-text-lo">Powered by</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {TRUST.map((t) => (
                    <span key={t} className="rounded-full border border-border bg-surface-raised px-3 py-1 text-xs text-text-mid">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* CTA */}
        <Section className="py-24 text-center">
          <h3 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Ready to see where your money actually sits?
          </h3>
          <button
            type="button"
            onClick={scrollToInput}
            className="mt-6 inline-flex items-center gap-2 rounded-[10px] bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            <Zap className="h-4 w-4" /> Track a wallet — it&apos;s free
          </button>
          <p className="mt-3 text-xs text-text-lo">No account. No wallet connection. Just paste an address.</p>
        </Section>

        {/* Footer */}
        <footer className="border-t border-border">
          <Section className="flex flex-wrap items-center justify-between gap-3 py-8 text-xs text-text-lo">
            <span>© {new Date().getFullYear()} walletfolio · multi-chain portfolio intelligence</span>
            <span>Read-only · non-custodial · free</span>
          </Section>
        </footer>
      </div>
    </div>
  );
}
