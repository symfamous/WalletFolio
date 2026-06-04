"use client";

import { useState, useEffect } from "react";
import { ArrowRight, Layers, ShieldCheck, TrendingUp, Zap, BarChart3, Eye } from "lucide-react";
import { WalletFolioBrand } from "@/components/brand/WalletFolioBrand";
import { cn } from "@/lib/utils";

interface LandingPageProps {
  onEnter: (opts?: { viewMode?: any; goal?: any; runCheckup?: boolean }) => void;
}

const GOALS = ["Mostly Safe", "Balanced", "Long-Term Growth", "Active Trader", "Learn Slowly"];

const CHIPS = [
  { icon: Layers, label: "EVM + Solana" },
  { icon: TrendingUp, label: "DeFi positions" },
  { icon: BarChart3, label: "Timeline" },
  { icon: ShieldCheck, label: "Risk monitor" },
  { icon: Eye, label: "Hidden funds" },
  { icon: Zap, label: "No wallet needed" },
];

function AnimatedStat({ target, suffix = "" }: { target: number | string; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const isNumber = typeof target === "number";

  useEffect(() => {
    if (!isNumber) return;
    const end = target as number;
    const startTime = performance.now();

    function step(now: number) {
      const progress = Math.min((now - startTime) / 1200, 1);
      setDisplay(Math.round(end * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }, [target, isNumber]);

  if (!isNumber) return <span>{target}{suffix}</span>;
  return <span>{display}{suffix}</span>;
}

export function LandingPage({ onEnter }: LandingPageProps) {
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden"
      style={{ background: "rgb(var(--bg))", fontFamily: "var(--font-geist-mono), monospace" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "linear-gradient(rgb(var(--accent) / 0.025) 1px,transparent 1px),linear-gradient(90deg,rgb(var(--accent) / 0.025) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
          animation: "gridMove 24s linear infinite",
        }}
      />

      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/2 top-0 h-[280px] w-[600px] -translate-x-1/2 rounded-full"
          style={{ background: "radial-gradient(ellipse,rgb(var(--accent) / 0.08),transparent 70%)", animation: "pulseGlow 5s ease-in-out infinite alternate" }}
        />
        <div
          className="absolute bottom-0 left-0 h-[200px] w-[300px] rounded-full"
          style={{ background: "radial-gradient(ellipse,rgb(var(--accent) / 0.05),transparent 70%)" }}
        />
        <div
          className="absolute right-0 top-1/3 h-[200px] w-[200px] rounded-full"
          style={{ background: "radial-gradient(ellipse,rgb(var(--accent) / 0.04),transparent 70%)" }}
        />
      </div>

      <style>{`
        @keyframes gridMove { 0%{background-position:0 0} 100%{background-position:40px 40px} }
        @keyframes pulseGlow { 0%{opacity:0.6;transform:translateX(-50%) scale(1)} 100%{opacity:1;transform:translateX(-50%) scale(1.08)} }
        @keyframes chipFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        @keyframes ctaGlow { 0%,100%{box-shadow:0 0 16px rgb(var(--accent) / 0.3),0 4px 12px rgb(var(--accent) / 0.15)} 50%{box-shadow:0 0 32px rgb(var(--accent) / 0.5),0 8px 24px rgb(var(--accent) / 0.25)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes gradAnim { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes brandGlow {
          0% { text-shadow: 0 0 12px rgb(var(--accent) / 0.18), 0 0 28px rgb(var(--accent) / 0.12); transform: translateY(0); }
          100% { text-shadow: 0 0 18px rgb(var(--accent) / 0.45), 0 0 48px rgb(var(--accent) / 0.18); transform: translateY(-2px); }
        }
      `}</style>

      <header
        className={cn(
          "relative z-10 flex justify-end px-5 pb-2 pt-5 transition-all duration-700",
          visible ? "opacity-100" : "opacity-0 -translate-y-2",
        )}
      >
        <button
          onClick={() => onEnter()}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
          style={{ border: "1px solid rgb(var(--accent) / 0.25)", background: "rgb(var(--accent) / 0.06)", color: "rgb(var(--accent))" }}
          onMouseEnter={(event) => { event.currentTarget.style.background = "rgb(var(--accent) / 0.12)"; }}
          onMouseLeave={(event) => { event.currentTarget.style.background = "rgb(var(--accent) / 0.06)"; }}
        >
          Open App <ArrowRight className="h-3 w-3" />
        </button>
      </header>

      <main
        className={cn(
          "relative z-10 flex flex-1 flex-col items-center justify-center px-5 py-8 text-center transition-all duration-700 delay-100",
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        )}
      >
        <p
          className="-mt-6 mb-8 text-[42px] font-black leading-none tracking-[-0.04em] sm:-mt-8 sm:mb-10 sm:text-[72px]"
          style={{
            fontFamily: "Arial, Helvetica, sans-serif",
            color: "rgb(var(--text-hi))",
            animation: "brandGlow 4s ease-in-out infinite alternate",
          }}
        >
          walletfolio
        </p>

        <div
          className="mb-6 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5"
          style={{ border: "1px solid rgb(var(--accent) / 0.2)", background: "rgb(var(--accent) / 0.06)" }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "rgb(var(--accent))", boxShadow: "0 0 5px rgb(var(--accent))", animation: "blink 2s ease-in-out infinite" }} />
          <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: "rgb(var(--accent))" }}>Multi-chain Portfolio Intelligence</span>
        </div>

        <h1
          className="mb-4 text-[30px] font-bold leading-[1.1] tracking-tight sm:text-5xl"
          style={{
            background: "linear-gradient(270deg,rgb(var(--accent)),rgb(var(--success)),rgb(var(--accent)),rgb(var(--success)),rgb(var(--accent)))",
            backgroundSize: "300% 300%",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            animation: "gradAnim 5s ease infinite",
          }}
        >
          Your complete crypto portfolio in one view
        </h1>

        <p className="mb-7 max-w-md text-sm leading-relaxed sm:text-[15px]" style={{ color: "rgb(var(--text-mid))" }}>
          Paste any EVM or Solana wallet to see balances, DeFi positions, Hyperliquid exposure, and risk across chains instantly.
        </p>

        <button
          onClick={() => onEnter()}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="group relative mb-3 inline-flex items-center gap-2 overflow-hidden rounded-2xl px-7 py-3.5 text-sm font-bold transition-all duration-300 active:scale-[0.97]"
          style={{
            background: "rgb(var(--accent))",
            color: "rgb(var(--bg))",
            animation: "ctaGlow 3s ease-in-out infinite",
          }}
        >
          Enter App
          <ArrowRight className={cn("h-4 w-4 transition-transform duration-300", hovered && "translate-x-1")} />
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        </button>
        <p className="text-[10px]" style={{ color: "rgb(var(--text-lo))" }}>No wallet connection - Read-only - Free</p>

        <div className="mt-8 flex items-center justify-center gap-8">
          {[
            { value: 30, suffix: "+", label: "chains" },
            { value: "$0", label: "cost" },
            { value: "0", label: "sign-in" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-xl font-bold" style={{ color: "rgb(var(--text-hi))" }}>
                {typeof stat.value === "number"
                  ? <AnimatedStat target={stat.value} suffix={stat.suffix} />
                  : stat.value}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-widest" style={{ color: "rgb(var(--text-lo))" }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </main>

      <section className={cn("relative z-10 px-5 pb-8 transition-all duration-700 delay-200", visible ? "opacity-100" : "opacity-0")}>
        <div className="flex flex-wrap justify-center gap-2">
          {CHIPS.map(({ icon: Icon, label }, index) => (
            <div
              key={label}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
              style={{
                border: "1px solid rgb(var(--accent) / 0.1)",
                background: "rgb(var(--accent) / 0.03)",
                color: "rgb(var(--text-mid))",
                animation: `chipFloat ${2.5 + index * 0.3}s ${index * 0.2}s ease-in-out infinite`,
              }}
            >
              <Icon className="h-3 w-3 shrink-0" style={{ color: "rgb(var(--accent))" }} strokeWidth={1.5} />
              {label}
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid rgb(var(--accent) / 0.06)" }}>
        <WalletFolioBrand size={20} wordmarkClassName="text-[11px]" />
        <p className="text-[10px]" style={{ color: "rgb(var(--text-lo))" }}>// read-only - free</p>
      </footer>
    </div>
  );
}
