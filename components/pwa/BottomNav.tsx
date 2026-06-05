"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Calculator, Coins, History, Layers, LayoutDashboard, TrendingUp, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type PWATab = "overview" | "holdings" | "defi" | "trading" | "activity" | "insights" | "tools" | "profile";

interface BottomNavProps {
  active:      PWATab;
  onChange:    (tab: PWATab) => void;
  alertBadge?: number;
}

const TABS: Array<{ id: PWATab; label: string; shortLabel: string; ariaLabel: string; icon: LucideIcon }> = [
  { id: "overview", label: "HOME",      shortLabel: "HOME",  ariaLabel: "Overview", icon: LayoutDashboard },
  { id: "holdings", label: "HOLDINGS",  shortLabel: "HOLD",  ariaLabel: "Holdings", icon: Coins },
  { id: "defi",     label: "DEFI",      shortLabel: "DEFI",  ariaLabel: "DeFi", icon: Layers },
  { id: "trading",  label: "TRADE",     shortLabel: "TRADE", ariaLabel: "Trading", icon: TrendingUp },
  { id: "activity", label: "ACTIVITY",  shortLabel: "ACT",   ariaLabel: "Activity", icon: History },
  { id: "insights", label: "INSIGHTS",  shortLabel: "AI",    ariaLabel: "Insights", icon: Bot },
  { id: "tools",    label: "TOOLS",     shortLabel: "TOOLS", ariaLabel: "Tools", icon: Calculator },
  { id: "profile",  label: "PROFILE",   shortLabel: "YOU",   ariaLabel: "Profile", icon: User },
];

export function BottomNav({ active, onChange, alertBadge }: BottomNavProps) {
  const [isMobile, setIsMobile] = useState(false);
  const activeIndex = TABS.findIndex((t) => t.id === active);
  const [pillLeft, setPillLeft] = useState(0);
  const [pillWidth, setPillWidth] = useState(0);
  const navRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const btn = btnRefs.current[activeIndex];
    const nav = navRef.current;
    if (!btn || !nav) return;
    const navRect = nav.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setPillLeft(btnRect.left - navRect.left);
    setPillWidth(btnRect.width);
  }, [activeIndex]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: "rgb(var(--bg) / 0.92)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "1px solid rgb(var(--accent) / 0.1)",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.5), 0 -1px 0 rgb(var(--accent) / 0.06)",
      }}
    >
      <div ref={navRef} className="relative flex items-stretch" style={{ height: isMobile ? 50 : 56 }}>
        <div
          className="pointer-events-none absolute top-1.5 bottom-1.5 rounded-xl transition-all duration-300 ease-out"
          style={{
            left: pillLeft + 3,
            width: pillWidth > 6 ? pillWidth - 6 : pillWidth,
            opacity: pillWidth > 0 ? 1 : 0,
            background: "rgb(var(--accent) / 0.07)",
            boxShadow: "0 0 10px rgb(var(--accent) / 0.08)",
          }}
        />

        {TABS.map((tab, i) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;

          return (
            <button
              key={tab.id}
              ref={(el) => { btnRefs.current[i] = el; }}
              onClick={() => onChange(tab.id)}
              className={cn(
                "relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center transition-all duration-200 active:scale-90",
                isMobile ? "gap-0 px-0.5" : "gap-0.5 px-1"
              )}
              style={{ color: isActive ? "rgb(var(--accent))" : "rgb(var(--text-lo))" }}
              aria-label={tab.ariaLabel}
            >
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 h-px w-5 -translate-x-1/2 rounded-full transition-all duration-300"
                  style={{
                    background: "linear-gradient(90deg,transparent,rgb(var(--accent)),transparent)",
                    boxShadow: "0 0 6px rgb(var(--accent) / 0.8)",
                  }}
                />
              )}

              <div className="relative">
                <Icon
                  className={isMobile ? "h-[15px] w-[15px]" : "h-[17px] w-[17px]"}
                  style={{ transition: "all 0.2s", strokeWidth: isActive ? 2 : 1.5, ...(isActive ? { filter: "drop-shadow(0 0 5px rgb(var(--accent) / 0.7))" } : {}) }}
                />
                {tab.id === "overview" && alertBadge && alertBadge > 0 && (
                  <span
                    className="absolute -top-1 -right-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-0.5 text-[10px] font-bold"
                    style={{
                      background: "rgb(var(--accent))",
                      color: "rgb(var(--bg))",
                      fontFamily: "var(--font-geist-mono), monospace",
                    }}
                  >
                    {alertBadge > 9 ? "9+" : alertBadge}
                  </span>
                )}
              </div>

              <span
                className={cn(
                  "font-bold leading-none tracking-wider transition-all duration-200",
                  isMobile ? "text-[9px]" : "text-[10px]"
                )}
                style={{
                  fontFamily: "var(--font-geist-mono), monospace",
                  ...(isActive
                    ? { color: "rgb(var(--accent))", textShadow: "0 0 8px rgb(var(--accent) / 0.6)" }
                    : { opacity: 0.4 }),
                }}
              >
                {isMobile ? tab.shortLabel : tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}