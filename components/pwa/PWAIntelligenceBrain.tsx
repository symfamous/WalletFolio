"use client";

import { useState } from "react";
import { usePWAData } from "@/components/pwa/PWAContext";
import { PortfolioIntelligence } from "@/components/PortfolioIntelligence";
import { PWASheet } from "@/components/pwa/PWASheet";

export function PWAIntelligenceBrain() {
  const [open, setOpen] = useState(false);
  const {
    portfolio,
    intelligence,
    attribution,
    hasHistory,
    format,
    currency,
  } = usePWAData();

  if (!portfolio || !intelligence) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-4 z-30 flex items-center gap-2 rounded-full border border-accent/30 bg-bg/90 px-3.5 py-2.5 text-left shadow-2xl backdrop-blur-xl transition-transform active:scale-[0.98]"
        style={{ bottom: "calc(76px + env(safe-area-inset-bottom, 0px))" }}
        aria-label="Open intelligence"
      >
        <span className="text-sm leading-none" aria-hidden="true">🧠</span>
        <span
          className="text-sm font-semibold text-text-hi"
          style={{ textShadow: "0 0 12px rgb(var(--accent)/0.22)" }}
        >
          Intelligence
        </span>
      </button>

      <PWASheet
        open={open}
        onClose={() => setOpen(false)}
        title="Intelligence"
        subtitle="Review where your money sits, what changed, and how things are going."
      >
        <PortfolioIntelligence
          pi={intelligence}
          portfolio={portfolio}
          format={format}
          currency={currency}
          attribution={attribution}
          hasHistory={hasHistory}
          layout="tabs"
          allowedSections={["where", "change", "pnl"]}
          tabPickerStyle="grid"
        />
      </PWASheet>
    </>
  );
}
