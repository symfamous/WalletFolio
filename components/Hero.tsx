import { TrendingUp, Layers, Calculator, ShieldCheck, Building2 } from "lucide-react";

const FEATURES = [
  {
    icon: Building2,
    title: "DeFi positions included",
    desc: "Morpho, Aave, Compound, Uniswap LP, staking, lending, borrowing — all in one view",
  },
  {
    icon: Layers,
    title: "30+ EVM chains",
    desc: "Chain coverage is dynamic — grows automatically as new networks are supported",
  },
  {
    icon: TrendingUp,
    title: "Cross-chain aggregation",
    desc: "Total ETH, USDC, and any token combined across all wallets and DeFi protocols",
  },
  {
    icon: Calculator,
    title: "Aggregated calculator",
    desc: "Target price uses your true total holdings — wallet + DeFi positions combined",
  },
  {
    icon: ShieldCheck,
    title: "No wallet connection",
    desc: "Paste any address. Read-only. No signing, no permissions, no account",
  },
];

export function Hero() {
  return (
    <section className="relative py-12 sm:py-20 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-100" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-accent/5 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/8 px-4 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
          <span className="text-xs font-medium text-accent tracking-wide">
            Wallet + DeFi · Paste address · Track instantly
          </span>
        </div>

        <h1 className="mb-5 text-4xl font-semibold tracking-tight text-text-hi sm:text-5xl leading-[1.08]">
          Complete EVM portfolio{" "}
          <span style={{
            background: "linear-gradient(135deg, rgb(var(--accent)) 0%, rgb(var(--accent)/0.85) 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>
            including DeFi
          </span>
        </h1>

        <p className="mx-auto mb-10 max-w-xl text-base text-text-mid leading-relaxed sm:text-[17px]">
          Paste any EVM wallet address. See every token and DeFi position across
          all chains — with live prices, cross-chain aggregation, and a target price
          calculator that uses your true total holdings.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-left">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-3.5 rounded-xl border border-border bg-surface p-4 hover:border-border-subtle transition-colors">
              <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/10">
                <Icon className="h-4 w-4 text-accent" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium text-text-hi">{title}</p>
                <p className="mt-0.5 text-xs text-text-mid leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
