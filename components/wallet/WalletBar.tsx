"use client";

import { useState } from "react";
import { Plus, X, Wallet2, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { formatUSD, normalizeTrackedAddress } from "@/lib/utils";
import type { WalletEntry } from "@/hooks/useMultiWallet";
import type { WalletResult } from "@/hooks/useMultiPortfolio";

interface WalletBarProps {
  wallets:        WalletEntry[];
  walletResults:  WalletResult[];
  combined:       { totalUsdValue: number };
  activeAddress:  string;
  onSelect:       (address: string) => void;
  onAdd:          (address: string) => void;
  onRemove:       (address: string) => void;
}

function shortenAddr(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

export function WalletBar({
  wallets, walletResults, combined, activeAddress, onSelect, onAdd, onRemove,
}: WalletBarProps) {
  const [adding, setAdding] = useState(false);
  const [input,  setInput]  = useState("");
  const [open,   setOpen]   = useState(false);

  const activeWallet = walletResults.find((wr) => wr.address === activeAddress);
  const activeTotal = activeWallet?.data?.portfolio?.summary?.totalUsdValue;

  function handleAdd() {
    const val = normalizeTrackedAddress(input);
    if (!val) return;
    onAdd(val);
    setInput("");
    setAdding(false);
  }

  return (
    <div
      className="animate-fade-up overflow-hidden rounded-[12px] border border-accent/6 bg-transparent"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-2 py-1.5 text-left transition-colors hover:bg-accent/[0.018]"
        style={{ borderBottom: open ? "1px solid rgb(var(--accent)/0.06)" : "none" }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-6.5 w-6.5 items-center justify-center rounded-[8px] border border-accent/10 bg-accent/5">
            <Wallet2 className="h-3.5 w-3.5 text-accent" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-lo/90">
                Wallets
              </span>
              <span
                className="rounded-full border border-accent/12 bg-accent/7 px-1.5 py-0.5 text-[10px] text-accent"
              >
                {wallets.length}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-[10px] uppercase tracking-[0.1em] text-text-mid">
              <span className="truncate">{activeWallet?.label || shortenAddr(activeAddress)}</span>
              {activeTotal !== undefined ? <span className="num text-text-hi/95">{formatUSD(activeTotal)}</span> : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden rounded-full border border-[rgb(var(--border)/0.3)] bg-[rgb(var(--surface-raised)/0.5)] px-2 py-0.75 text-[10px] uppercase tracking-[0.14em] text-text-mid sm:inline-flex">
            {open ? "Hide wallet controls" : "Show wallet controls"}
          </span>
          {wallets.length > 1 && (
            <span className="num hidden text-sm font-semibold text-text-hi lg:inline">
              {formatUSD(combined.totalUsdValue)}
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-text-lo" /> : <ChevronDown className="h-4 w-4 text-text-lo" />}
        </div>
      </button>

      {open && (
        <div className="flex flex-col gap-3 p-3">
          <div className="flex flex-wrap gap-2">
            {walletResults.map((wr) => {
              const isActive = wr.address === activeAddress;
              const total    = wr.data?.portfolio?.summary?.totalUsdValue;
              return (
                <div
                  key={wr.address}
                  className="group flex cursor-pointer items-center gap-2 rounded-[12px] px-3 py-2 transition-all hover:-translate-y-[1px]"
                  style={{
                    border: isActive ? "1px solid rgb(var(--accent) / 0.18)" : "1px solid rgb(var(--border) / 0.3)",
                    background: isActive ? "linear-gradient(180deg,rgb(var(--accent) / 0.08),rgb(var(--accent) / 0.03))" : "rgb(var(--surface-raised) / 0.5)",
                  }}
                  onClick={() => onSelect(wr.address)}
                >
                  <div className="flex items-center gap-1.5">
                    {isActive && <CheckCircle2 className="h-3 w-3 text-accent" />}
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: isActive ? "rgb(var(--accent))" : "rgb(var(--text-mid))" }}>
                        {wr.label || shortenAddr(wr.address)}
                      </div>
                      {total !== undefined && (
                        <div className="num text-[10px]" style={{ color: isActive ? "rgb(var(--text-hi))" : "rgb(var(--text-lo))" }}>
                          {formatUSD(total)}
                        </div>
                      )}
                      {wr.isLoading && (
                        <div className="text-[9px] text-text-lo">loading…</div>
                      )}
                    </div>
                  </div>
                  {wallets.length > 1 && (
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                      onClick={(e) => { e.stopPropagation(); onRemove(wr.address); }}
                      title="Remove wallet"
                    >
                      <X className="h-3 w-3" style={{ color: "rgb(var(--danger))" }} />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Add wallet button / input */}
            {!adding ? (
              <button
                onClick={() => setAdding(true)}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-bold tracking-widest uppercase transition-all"
                style={{
                  border: "1px dashed rgb(var(--border) / 0.4)",
                  color: "rgb(var(--text-lo))",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "rgb(var(--text-mid))"; e.currentTarget.style.borderColor = "rgb(var(--border) / 0.6)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgb(var(--text-lo))"; e.currentTarget.style.borderColor = "rgb(var(--border) / 0.4)"; }}
              >
                <Plus className="h-3 w-3" /> Add wallet
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                <input
                  autoFocus
                  type="text"
                  placeholder="0x… or Solana base58"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setAdding(false); setInput(""); } }}
                  className="flex-1 h-8 px-3 rounded-lg text-xs outline-none"
                  style={{
                    background: "rgb(var(--surface-raised))",
                    border: "1px solid rgb(var(--border))",
                    color: "rgb(var(--text-hi))",
                  }}
                />
                <button
                  onClick={handleAdd}
                  className="h-8 px-3 rounded-lg text-xs font-bold transition-all"
                  style={{ background: "rgb(var(--accent))", color: "rgb(var(--bg))" }}
                >
                  Add
                </button>
                <button
                  onClick={() => { setAdding(false); setInput(""); }}
                  className="h-8 w-8 flex items-center justify-center rounded-lg transition-all"
                  style={{ border: "1px solid rgb(var(--border) / 0.3)", color: "rgb(var(--text-mid))" }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {wallets.length > 1 && (
            <div
              className="mt-1 flex items-center justify-between rounded-xl px-3 py-2"
              style={{ background: "rgb(var(--surface-raised) / 0.4)", border: "1px solid rgb(var(--border) / 0.3)" }}
            >
              <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgb(var(--text-lo))" }}>
                Combined total
              </span>
              <span className="num text-sm font-bold" style={{ color: "rgb(var(--text-hi))" }}>
                {formatUSD(combined.totalUsdValue)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
