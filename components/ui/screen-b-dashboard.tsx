"use client";

import { useState } from "react";
import { ArrowRight, Copy, ExternalLink, Activity, PieChart, ChevronDown } from "lucide-react";
import { WalletFolioMark } from "@/components/brand/WalletFolioBrand";
import { cn } from "@/lib/utils";

export interface ScreenBDashboardProps {
  onEnterApp?: () => void;
  className?: string;
}

// Token logo helper — uses available SVG or falls back to colored circle
function TokenIcon({ src, symbol, size = 20 }: { src?: string; symbol: string; size?: number }) {
  const colors: Record<string, string> = {
    USDC: "#2775CA", WIF: "#FF6B9D", Jupiter: "#00f3ff", Raydium: "#6B8EFF", Marinade: "#FF6B6B",
  };
  if (src) {
    return <img src={src} alt={symbol} className="rounded-full object-contain" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="rounded-full flex items-center justify-center font-mono font-bold text-[10px]"
      style={{ width: size, height: size, backgroundColor: `${colors[symbol] ?? "#00f3ff"}22`, border: `1px solid ${colors[symbol] ?? "#00f3ff"}44`, color: colors[symbol] ?? "#00f3ff" }}
    >
      {symbol.slice(0, 2)}
    </div>
  );
}

// Mock data
const MOCK_HOLDINGS = [
  { symbol: "SOL", name: "Solana", price: 150.32, change24h: 4.2, change7d: 12.8, amount: 5.2312, value: 786.23, logo: "/token-solana.svg" },
  { symbol: "BTC", name: "Bitcoin", price: 67420.5, change24h: 1.8, change7d: 5.4, amount: 0.2841, value: 19156.82, logo: "/token-bitcoin.svg" },
  { symbol: "ETH", name: "Ethereum", price: 3520.8, change24h: -2.1, change7d: 3.2, amount: 1.1205, value: 3945.67, logo: "/token-ethereum.svg" },
  { symbol: "USDC", name: "USD Coin", price: 1.0, change24h: 0.01, change7d: 0.02, amount: 2847.5, value: 2847.5, logo: undefined },
  { symbol: "WIF", name: "dogwifhat", price: 2.34, change24h: 8.7, change7d: 22.1, amount: 712.0, value: 1666.08, logo: "/token-dogwifhat.svg" },
];

const MOCK_DEFI = [
  { name: "Jupiter", logo: undefined, tvl: "$142.5M", apr: "8.2%" },
  { name: "Raydium", logo: undefined, tvl: "$89.3M", apr: "5.7%" },
  { name: "Marinade", logo: undefined, tvl: "$34.1M", apr: "6.4%" },
];

const MOCK_SOLANA_ECOSYSTEM = [
  { name: "Jupiter", pct: 28.4, color: "#00f3ff" },
  { name: "Raydium", pct: 18.2, color: "#6B8EFF" },
  { name: "Marinade", pct: 12.1, color: "#FF6B6B" },
  { name: "Sanctum", pct: 8.3, color: "#FFB347" },
];

export function ScreenBDashboard({ onEnterApp, className }: ScreenBDashboardProps) {
  const [walletInput, setWalletInput] = useState("");
  const totalBalance = 23403.92;
  const change24h = 3203.43;
  const changePct = 15.8;

  return (
    <section
      className={cn(
        "min-h-screen bg-[radial-gradient(circle_at_14%_12%,rgba(0,243,255,0.06),transparent_22%),radial-gradient(circle_at_86%_15%,rgba(0,243,255,0.05),transparent_24%),linear-gradient(180deg,#04060a,#04060a)] px-6 py-6 text-[#dce6ff] sm:px-8",
        className,
      )}
    >
      <div className="pointer-events-none fixed inset-0 opacity-60 [background-image:linear-gradient(rgba(0,243,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,243,255,0.03)_1px,transparent_1px)] [background-size:40px_40px]" />

      <div className="relative z-10 mx-auto max-w-[120rem] rounded-[30px] border border-[rgba(0,243,255,0.16)] bg-[linear-gradient(180deg,rgba(18,19,24,0.92),rgba(18,19,24,0.9))] shadow-[0_20px_60px_rgba(0,0,0,0.38)]">
        <div className="p-5 sm:p-7">

          {/* ─── Top Header Bar ─── */}
          <div className="mb-6 flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="wf-brand-icon flex h-11 w-11 items-center justify-center rounded-[10px] bg-[rgba(0,243,255,0.08)] border border-[rgba(0,243,255,0.2)] shadow-[0_0_20px_rgba(0,243,255,0.15)]">
                <WalletFolioMark size={36} />
              </div>
              <div>
                <span className="wf-brand-name block text-[20px] font-extrabold tracking-[-0.03em] text-[#dce6ff]">walletfolio</span>
                <span className="wf-brand-tag block font-mono text-[10px] uppercase tracking-[0.14em] text-[#547564]">Portfolio Tracker</span>
              </div>
            </div>

            {/* Center tagline */}
            <p className="hidden font-mono text-[11px] uppercase tracking-[0.12em] text-[#547564] sm:block">
              Paste wallet address to get started
            </p>

            {/* Connected indicator */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-[rgba(0,243,255,0.25)] bg-[rgba(0,243,255,0.06)] px-3 py-1.5 font-mono text-[11px] text-[#00f3ff]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00f3ff] shadow-[0_0_6px_#00f3ff]" />
                Connected
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-3 py-1.5 font-mono text-[11px] text-[#94baa6]">
                <span className="text-[#00f3ff]">sol</span>
                <span className="text-[#547564]">4 ZeGY…7qHP</span>
                <Copy className="h-3 w-3 text-[#547564]" />
              </div>
              <button
                type="button"
                onClick={onEnterApp}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-[#547564] transition-all hover:border-[rgba(255,255,255,0.2)] hover:text-[#dce6ff]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* ─── 3-Column Dashboard Grid ─── */}
          <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_240px]">

            {/* ── Left Sidebar ── */}
            <aside className="rounded-[24px] border border-[rgba(0,243,255,0.14)] bg-[linear-gradient(180deg,rgba(30,31,37,0.95),rgba(18,19,24,0.97))] p-5">

              {/* Portfolio Overview */}
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#547564]">Portfolio Overview</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#94baa6]">Total balance</p>
                <p className="mt-2 text-[30px] font-extrabold tracking-[-0.04em] text-[#dce6ff]">$23,403.92</p>
                <p className="mt-1 font-mono text-[12px] text-[#00f3ff]">
                  + $3,203.43 <span className="text-[#00f3ff]/60">({changePct}%)</span> today
                </p>
              </div>

              {/* Divider */}
              <div className="my-4 border-t border-[rgba(255,255,255,0.06)]" />

              {/* SOL Balance */}
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#547564]">Solana Ecosystem</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(255,255,255,0.06)]">
                    <img src="/token-solana.svg" alt="SOL" className="h-6 w-6 rounded-full object-contain" />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-[#dce6ff]">5.2312 SOL</p>
                    <p className="font-mono text-[11px] text-[#94baa6]">$786.23</p>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="my-4 border-t border-[rgba(255,255,255,0.06)]" />

              {/* Allocation mini chart */}
              <div>
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#547564]">Allocation</p>
                <div className="space-y-2">
                  {[
                    { symbol: "SOL", pct: 68.2, color: "#00f3ff" },
                    { symbol: "BTC", pct: 18.4, color: "#F7931A" },
                    { symbol: "ETH", pct: 9.2, color: "#627EEA" },
                    { symbol: "USDC", pct: 2.1, color: "#2775CA" },
                    { symbol: "WIF", pct: 2.1, color: "#FF6B9D" },
                  ].map((item) => (
                    <div key={item.symbol} className="flex items-center gap-2">
                      <span className="w-8 font-mono text-[10px] text-[#94baa6]">{item.symbol}</span>
                      <div className="h-1.5 flex-1 rounded-full bg-[rgba(255,255,255,0.06)]">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                        />
                      </div>
                      <span className="w-8 text-right font-mono text-[10px] text-[#94baa6]">{item.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="my-4 border-t border-[rgba(255,255,255,0.06)]" />

              {/* CTA */}
              <div>
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#547564]">Track your wallet</p>
                <div className="relative">
                  <input
                    type="text"
                    value={walletInput}
                    onChange={(e) => setWalletInput(e.target.value)}
                    placeholder="solana address..."
                    className="wf-input w-full rounded-[14px] border border-[rgba(0,243,255,0.16)] bg-[rgba(255,255,255,0.03)] px-4 py-3 font-mono text-[12px] text-[#dce6ff] placeholder-[#547564] outline-none transition-colors focus:border-[rgba(0,243,255,0.4)]"
                  />
                  <button
                    type="button"
                    onClick={onEnterApp}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-[14px] border border-[rgba(0,243,255,0.3)] bg-[linear-gradient(180deg,rgba(0,243,255,0.15),rgba(0,243,255,0.08))] px-4 py-3 font-mono text-[12px] font-bold text-[#dce6ff] shadow-[0_0_16px_rgba(0,243,255,0.1)] transition-all hover:border-[rgba(0,243,255,0.5)]"
                  >
                    Analyze Wallet
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </aside>

            {/* ── Main Content ── */}
            <main className="rounded-[24px] border border-[rgba(0,243,255,0.14)] bg-[linear-gradient(180deg,rgba(30,31,37,0.95),rgba(18,19,24,0.97))] overflow-hidden">

              {/* Ticker bar */}
              <div className="flex items-center gap-4 overflow-x-auto border-b border-[rgba(0,243,255,0.08)] bg-[rgba(12,16,16,0.9)] px-4 py-2">
                {MOCK_HOLDINGS.map((t, i) => (
                  <div key={t.symbol} className="flex items-center gap-2 whitespace-nowrap">
                    <span className="font-mono text-[10px] text-[#547564]">{t.symbol}</span>
                    <span className="font-mono text-[11px] font-semibold text-[#dce6ff]">
                      ${t.price.toLocaleString("en-US", { maximumFractionDigits: t.price < 1 ? 3 : 2 })}
                    </span>
                    <span className={cn("font-mono text-[10px]", t.change24h >= 0 ? "text-[#00f3ff]" : "text-[#ff6b6b]")}>
                      {t.change24h >= 0 ? "+" : ""}{t.change24h.toFixed(2)}%
                    </span>
                    {i < MOCK_HOLDINGS.length - 1 && <span className="mx-1 text-[rgba(255,255,255,0.1)]">|</span>}
                  </div>
                ))}
              </div>

              {/* Holdings Table */}
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#547564]">Token Holdings</p>
                  <button type="button" className="flex items-center gap-1 font-mono text-[10px] text-[#00f3ff] uppercase tracking-[0.1em]">
                    View All <ChevronDown className="h-3 w-3" />
                  </button>
                </div>

                <div className="rounded-[18px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1.2fr] gap-2 border-b border-[rgba(255,255,255,0.06)] px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[#547564]">
                    <span>Token</span>
                    <span className="text-right">Price</span>
                    <span className="text-right">24h</span>
                    <span className="text-right">7d</span>
                    <span className="text-right">Holdings</span>
                  </div>

                  {/* Table rows */}
                  {MOCK_HOLDINGS.map((token, i) => (
                    <div
                      key={token.symbol}
                      className={cn(
                        "grid grid-cols-[2fr_1fr_1fr_1fr_1.2fr] items-center gap-2 px-4 py-3 transition-colors",
                        i < MOCK_HOLDINGS.length - 1 ? "border-b border-[rgba(255,255,255,0.04)]" : "",
                      )}
                    >
                      {/* Token */}
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(255,255,255,0.06)]">
                          <img src={token.logo} alt={token.symbol} className="h-5 w-5 rounded-full object-contain" />
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-[#dce6ff]">{token.symbol}</p>
                          <p className="font-mono text-[9px] text-[#547564]">{token.name}</p>
                        </div>
                      </div>
                      {/* Price */}
                      <p className="text-right font-mono text-[11px] text-[#dce6ff]">
                        ${token.price.toLocaleString("en-US", { maximumFractionDigits: token.price < 1 ? 3 : 2 })}
                      </p>
                      {/* 24h */}
                      <p className={cn("text-right font-mono text-[11px]", token.change24h >= 0 ? "text-[#00f3ff]" : "text-[#ff6b6b]")}>
                        {token.change24h >= 0 ? "+" : ""}{token.change24h.toFixed(2)}%
                      </p>
                      {/* 7d */}
                      <p className={cn("text-right font-mono text-[11px]", token.change7d >= 0 ? "text-[#00f3ff]" : "text-[#ff6b6b]")}>
                        {token.change7d >= 0 ? "+" : ""}{token.change7d.toFixed(2)}%
                      </p>
                      {/* Holdings */}
                      <div className="text-right">
                        <p className="font-mono text-[11px] font-semibold text-[#dce6ff]">${token.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p className="font-mono text-[9px] text-[#547564]">{token.amount.toLocaleString("en-US", { maximumFractionDigits: 4 })} {token.symbol}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk Assessment */}
              <div className="border-t border-[rgba(255,255,255,0.06)] p-4">
                <div className="rounded-[18px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(255,200,0,0.1)]">
                        <Activity className="h-3.5 w-3.5 text-[#ffc800]" />
                      </div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#547564]">Risk Assessment</p>
                    </div>
                    <span className="rounded-full border border-[rgba(255,200,0,0.3)] bg-[rgba(255,200,0,0.08)] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#ffc800]">
                      Medium Risk
                    </span>
                  </div>

                  {/* Risk metrics */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Sharpe Ratio", value: "1.82", subtext: "Above avg", positive: true },
                      { label: "Volatility", value: "24.3%", subtext: "Moderate", positive: true },
                      { label: "Max Drawdown", value: "-18.6%", subtext: "Acceptable", positive: false },
                    ].map((metric) => (
                      <div key={metric.label} className="rounded-[14px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3">
                        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#547564]">{metric.label}</p>
                        <p className={cn("mt-1 text-[18px] font-extrabold tracking-[-0.03em]", metric.positive ? "text-[#00f3ff]" : "text-[#ffc800]")}>
                          {metric.value}
                        </p>
                        <p className="font-mono text-[9px] text-[#547564]">{metric.subtext}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </main>

            {/* ── Right Sidebar ── */}
            <aside className="space-y-4">

              {/* DeFi Protocols */}
              <div className="rounded-[24px] border border-[rgba(0,243,255,0.14)] bg-[linear-gradient(180deg,rgba(30,31,37,0.95),rgba(18,19,24,0.97))] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#547564]">DeFi Protocols</p>
                  <button type="button" className="font-mono text-[9px] text-[#00f3ff] uppercase tracking-[0.1em]">View All</button>
                </div>
                <div className="space-y-2">
                  {MOCK_DEFI.map((protocol) => (
                    <div key={protocol.name} className="flex items-center justify-between rounded-[14px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(255,255,255,0.06)]">
                          <img src={protocol.logo} alt={protocol.name} className="h-4 w-4 rounded-full object-contain" />
                        </div>
                        <span className="font-mono text-[11px] text-[#dce6ff]">{protocol.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-[10px] text-[#94baa6]">{protocol.tvl}</p>
                        <p className="font-mono text-[9px] text-[#00f3ff]">{protocol.apr}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Wallet Allocation */}
              <div className="rounded-[24px] border border-[rgba(0,243,255,0.14)] bg-[linear-gradient(180deg,rgba(30,31,37,0.95),rgba(18,19,24,0.97))] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#547564]">Wallet Allocation</p>
                  <PieChart className="h-3.5 w-3.5 text-[#547564]" />
                </div>

                {/* Pie chart */}
                <div className="relative mx-auto mb-4 flex h-32 w-32 items-center justify-center">
                  <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#00f3ff" strokeWidth="12"
                      strokeDasharray="162.6 76.4" strokeDashoffset="0" />
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#F7931A" strokeWidth="12"
                      strokeDasharray="43.9 195.1" strokeDashoffset="-162.6" />
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#627EEA" strokeWidth="12"
                      strokeDasharray="21.9 217.1" strokeDashoffset="-206.5" />
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#2775CA" strokeWidth="12"
                      strokeDasharray="10.0 229.0" strokeDashoffset="-228.4" />
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#FF6B9D" strokeWidth="12"
                      strokeDasharray="10.0 229.0" strokeDashoffset="-238.4" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-[22px] font-extrabold text-[#dce6ff]">68.2%</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#547564]">SOL</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {[
                    { symbol: "SOL", name: "Solana", pct: 68.2, color: "#00f3ff" },
                    { symbol: "BTC", name: "Bitcoin", pct: 18.4, color: "#F7931A" },
                    { symbol: "ETH", name: "Ethereum", pct: 9.2, color: "#627EEA" },
                  ].map((item) => (
                    <div key={item.symbol} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="flex-1 font-mono text-[10px] text-[#94baa6]">{item.name}</span>
                      <span className="font-mono text-[10px] text-[#dce6ff]">{item.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Solana Ecosystem */}
              <div className="rounded-[24px] border border-[rgba(0,243,255,0.14)] bg-[linear-gradient(180deg,rgba(30,31,37,0.95),rgba(18,19,24,0.97))] p-4">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#547564]">Solana Ecosystem</p>
                <div className="space-y-2">
                  {MOCK_SOLANA_ECOSYSTEM.map((item) => (
                    <div key={item.name} className="flex items-center justify-between rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-mono text-[10px] text-[#94baa6]">{item.name}</span>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-[#dce6ff]">{item.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

            </aside>
          </div>
        </div>
      </div>

      <style jsx>{`
        .wf-brand-icon {
          box-shadow: 0 0 16px rgba(31, 203, 99, 0.15), 0 0 4px rgba(31, 203, 99, 0.08);
        }
        .wf-brand-name {
          text-shadow: 0 0 20px rgba(64, 234, 136, 0.35), 0 0 40px rgba(64, 234, 136, 0.15);
        }
        .wf-brand-tag {
          letter-spacing: 0.18em;
          color: #547564;
        }
      `}</style>
    </section>
  );
}
