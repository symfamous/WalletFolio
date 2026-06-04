"use client";

import { useState, useEffect } from "react";
import { usePWAData } from "@/components/pwa/PWAContext";
import { ProtocolPositions } from "@/components/portfolio/ProtocolPositions";
import { HiddenFundsScanner } from "@/components/intelligence/HiddenFundsScanner";
import { CollapsibleSection } from "@/components/common/CollapsibleSection";
import { DashboardSkeleton } from "@/components/common/Skeleton";
import { Eye, EyeOff, Building2 } from "lucide-react";
import { formatUSD } from "@/lib/utils";
import { buildProtocolPositions } from "@/lib/normalize/protocols";
import { TabHero } from "@/components/pwa/TabHero";

const LS_HIDE_DEFI = "pseryte_hide_defi";

export function DeFiTab() {
  const { portfolio, intelligence, isLoading, address, visibleSections } = usePWAData();
  const [hideDeFi, setHideDeFi] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHideDeFi(localStorage.getItem(LS_HIDE_DEFI) === "1");
  }, []);

  function toggleHideDeFi() {
    const next = !hideDeFi;
    setHideDeFi(next);
    localStorage.setItem(LS_HIDE_DEFI, next ? "1" : "0");
  }

  if (isLoading) return <div className="px-4 pt-3"><DashboardSkeleton /></div>;
  if (!portfolio) return null;

  const derivedProtocols = (portfolio.protocols.length > 0
    ? portfolio.protocols
    : buildProtocolPositions(portfolio.defiPositions)
  );
  const protocols = derivedProtocols.filter((p) => p.netUsdValue >= 5 || p.totalBorrowUsd > 0);
  const hiddenCount = intelligence?.hiddenFunds.length ?? 0;
  const hiddenValue = intelligence?.hiddenFunds.reduce((sum, fund) => sum + fund.usdValue, 0) ?? 0;

  return (
    <div className="space-y-3 px-4 pt-0 pb-24">
      <TabHero
        title="DeFi"
        address={address}
        totalValue={portfolio.summary.totalUsdValue}
        subtitle={protocols.length > 0 ? `${protocols.length} protocols` : undefined}
      />

      {protocols.length > 0 && (
        <div className="flex gap-2">
          {[
            { label: "Net DeFi", value: formatUSD(portfolio.summary.defiNetUsdValue, { compact: true }) },
            { label: "Protocols", value: String(protocols.length) },
            { label: "Borrowing", value: formatUSD(portfolio.protocols.reduce((s, p) => s + p.totalBorrowUsd, 0), { compact: true }) },
          ].map(({ label, value }) => (
            <div key={label} className="flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-center min-w-0">
              <p className="text-[10px] text-text-lo uppercase tracking-widest">{label}</p>
              <p className="num text-sm font-semibold text-text-hi truncate">{value}</p>
            </div>
          ))}
        </div>
      )}

      {visibleSections.detailedDefi && !hideDeFi && protocols.length > 0 && (
        <CollapsibleSection
          id="pwa-defi-positions"
          icon={Building2}
          title="DeFi Positions"
          badge={`${protocols.length} protocols`}
          badgeVariant="accent"
          summary={`${protocols.length} protocols | ${formatUSD(portfolio.summary.defiNetUsdValue, { compact: true })} net`}
          headerRight={
            <button onClick={toggleHideDeFi} className="p-1 rounded hover:bg-text-hi/10 transition-colors" title="Hide section">
              <EyeOff className="h-3.5 w-3.5 text-text-lo" />
            </button>
          }
        >
          <ProtocolPositions
            protocols={portfolio.protocols}
            totalDefiUsd={portfolio.summary.defiNetUsdValue}
          />
        </CollapsibleSection>
      )}

      {visibleSections.detailedDefi && hideDeFi && protocols.length > 0 && (
        <button
          onClick={toggleHideDeFi}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl border border-border bg-surface text-sm text-text-mid hover:bg-surface-raised transition-colors"
        >
          <Eye className="h-4 w-4" />
          Show DeFi Positions
        </button>
      )}

      {visibleSections.hiddenFunds && intelligence && (
        <CollapsibleSection
          id="pwa-hidden-funds"
          icon={Eye}
          title="Hidden Funds"
          badge={hiddenCount > 0 ? `${hiddenCount} found` : undefined}
          badgeVariant="accent"
          summary={hiddenCount > 0 ? `${hiddenCount} items | ${formatUSD(hiddenValue, { compact: true })}` : "No idle funds"}
          defaultCollapsed={hiddenCount === 0}
        >
          <HiddenFundsScanner portfolio={portfolio} intelligence={intelligence} />
        </CollapsibleSection>
      )}
    </div>
  );
}
