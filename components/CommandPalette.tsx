"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, BookOpen, Briefcase, Compass, History, Layers, LineChart,
  Moon, Search, Settings2, Share2, Sparkles, Sun, Target, Wallet, Zap,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { cn, shortenAddress } from "@/lib/utils";

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  group: "Navigate" | "Wallets" | "Actions";
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string;
  perform: () => void;
}

const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  overview: Compass, wallets: Wallet, intelligence: Sparkles, holdings: Briefcase,
  "defi-positions": Layers, perps: Activity, "wallet-history": History,
  scenarios: Target, patterns: BookOpen, pnl: LineChart, settings: Settings2,
};
const SECTION_LABELS: Record<string, string> = {
  overview: "Overview", wallets: "Wallets", intelligence: "Intelligence", holdings: "Holdings",
  "defi-positions": "DeFi", perps: "Perps", "wallet-history": "History",
  scenarios: "Scenarios", patterns: "Patterns", pnl: "P&L", settings: "Tools",
};

interface CommandPaletteProps {
  sections: string[];
  onNavigate: (id: string) => void;
  wallets: { address: string; label?: string }[];
  activeAddress?: string;
  onSelectWallet: (address: string) => void;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  onShare?: () => void;
}

/**
 * ⌘K / Ctrl-K command palette: jump to any section, switch wallets, toggle
 * theme/live. Self-contained — owns its open state and global key listener.
 */
export function CommandPalette(props: CommandPaletteProps) {
  const { sections, onNavigate, wallets, activeAddress, onSelectWallet, autoRefresh, onToggleAutoRefresh, onShare } = props;
  const { resolvedTheme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global ⌘K / Ctrl-K toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("walletfolio:open-command", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("walletfolio:open-command", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const commands = useMemo<Cmd[]>(() => {
    const run = (fn: () => void) => () => { fn(); setOpen(false); };
    const nav: Cmd[] = sections.map((id) => ({
      id: `nav:${id}`,
      label: SECTION_LABELS[id] ?? id,
      group: "Navigate",
      icon: SECTION_ICONS[id] ?? Compass,
      keywords: id,
      perform: run(() => onNavigate(id)),
    }));
    const wallet: Cmd[] = wallets.map((w) => ({
      id: `wallet:${w.address}`,
      label: w.label || shortenAddress(w.address),
      hint: w.address === activeAddress ? "Active" : shortenAddress(w.address),
      group: "Wallets",
      icon: Wallet,
      keywords: w.address + " " + (w.label ?? ""),
      perform: run(() => onSelectWallet(w.address)),
    }));
    const actions: Cmd[] = [
      {
        id: "action:theme",
        label: resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        group: "Actions",
        icon: resolvedTheme === "dark" ? Sun : Moon,
        keywords: "theme dark light mode",
        perform: run(toggle),
      },
      {
        id: "action:refresh",
        label: autoRefresh ? "Pause live refresh" : "Resume live refresh",
        group: "Actions",
        icon: Zap,
        keywords: "live auto refresh pause resume",
        perform: run(onToggleAutoRefresh),
      },
      ...(onShare
        ? [{
            id: "action:share",
            label: "Share portfolio card",
            group: "Actions" as const,
            icon: Share2,
            keywords: "share card image og export portfolio",
            perform: run(onShare),
          }]
        : []),
    ];
    return [...nav, ...wallet, ...actions];
  }, [sections, wallets, activeAddress, resolvedTheme, autoRefresh, onNavigate, onSelectWallet, toggle, onToggleAutoRefresh, onShare]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  if (!open) return null;

  const groups = ["Navigate", "Wallets", "Actions"] as const;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-start justify-center bg-black/60 px-4 pt-[12vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-[12px] border border-border bg-surface shadow-popover"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); filtered[active]?.perform(); }
        }}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-text-lo" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sections, wallets, actions…"
            className="h-12 w-full bg-transparent text-sm text-text-hi outline-none placeholder:text-text-lo"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-text-lo">ESC</kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-text-lo">No matches.</p>
          ) : (
            groups.map((group) => {
              const items = filtered.filter((c) => c.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} className="mb-1">
                  <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-text-lo">{group}</p>
                  {items.map((c) => {
                    const globalIdx = filtered.indexOf(c);
                    const isActive = globalIdx === active;
                    const Icon = c.icon;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onMouseEnter={() => setActive(globalIdx)}
                        onClick={c.perform}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-left text-sm transition-colors",
                          isActive ? "bg-accent/10 text-text-hi" : "text-text-mid hover:bg-surface-raised"
                        )}
                      >
                        <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-accent" : "text-text-lo")} />
                        <span className="flex-1 truncate">{c.label}</span>
                        {c.hint ? <span className="num text-[11px] text-text-lo">{c.hint}</span> : null}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
