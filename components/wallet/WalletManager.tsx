"use client";

import { useState } from "react";
import { Wallet2, Edit2, Trash2, Check, X } from "lucide-react";
import { cn, sameTrackedAddress, shortenAddress } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import type { SavedWallet } from "@/lib/wallets";

interface WalletManagerProps {
  wallets: SavedWallet[];
  currentAddress?: string;
  isCurrentSaved: boolean;
  onSaveCurrent: (label: string) => void;
  onRemove: (address: string) => void;
  onRename: (address: string, label: string) => void;
  onSwitch: (address: string) => void;
  defaultExpanded?: boolean;
}

function WalletRow({
  wallet,
  isCurrent,
  onRemove,
  onRename,
  onSwitch,
}: {
  wallet: SavedWallet;
  isCurrent: boolean;
  onRemove: (address: string) => void;
  onRename: (address: string, label: string) => void;
  onSwitch: (address: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(wallet.label);

  function handleSave() {
    onRename(wallet.address, label.trim() || wallet.label);
    setEditing(false);
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all",
        isCurrent
          ? "border-accent/30 bg-accent/5"
          : "border-border bg-surface-raised hover:border-border-subtle"
      )}
    >
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-text-hi"
        style={{ backgroundColor: wallet.color }}
      >
        {wallet.label.slice(0, 1).toUpperCase()}
      </div>

      {editing ? (
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          className="h-8 flex-1 rounded-md border border-accent/40 bg-surface px-2 text-sm text-text-hi focus:outline-none"
          autoFocus
        />
      ) : (
        <button
          onClick={() => !isCurrent && onSwitch(wallet.address)}
          disabled={isCurrent}
          className={cn(
            "flex flex-1 items-center justify-between gap-3 text-left",
            !isCurrent && "cursor-pointer"
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-hi">{wallet.label}</p>
            <p className="num text-[10px] text-text-lo">{shortenAddress(wallet.address)}</p>
          </div>
          {isCurrent ? (
            <span className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] text-accent border border-accent/20 bg-accent/10">
              Active
            </span>
          ) : (
            <span className="flex-shrink-0 rounded px-2 py-1 text-[10px] text-text-mid border border-border bg-bg/40">
              View portfolio
            </span>
          )}
        </button>
      )}

      <div className="flex flex-shrink-0 items-center gap-1">
        {editing ? (
          <>
            <button onClick={handleSave} className="p-1 text-success hover:text-success transition-colors" title="Save label">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => { setLabel(wallet.label); setEditing(false); }} className="p-1 text-text-lo hover:text-text-mid transition-colors" title="Cancel edit">
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setEditing(true)}
              className="p-1 text-text-lo hover:text-text-mid transition-colors"
              title="Rename wallet"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onRemove(wallet.address)}
              className="p-1 text-text-lo hover:text-danger transition-colors"
              title="Remove wallet"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function WalletManager({
  wallets,
  currentAddress,
  isCurrentSaved,
  onSaveCurrent,
  onRemove,
  onRename,
  onSwitch,
  defaultExpanded = false,
}: WalletManagerProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [newLabel, setNewLabel] = useState("");

  function handleSaveCurrent() {
    onSaveCurrent(newLabel.trim());
    setNewLabel("");
  }

  return (
    <div className="space-y-2 animate-fade-up">
      <button
        onClick={() => setExpanded((value) => !value)}
        className="group flex w-full items-center gap-2.5 py-0.5 text-left"
      >
        <Wallet2 className="h-4 w-4 text-accent" strokeWidth={1.5} />
        <h2 className="text-sm font-semibold text-text-hi">Saved Wallets</h2>
        <span className="num text-xs text-text-lo">{wallets.length}</span>
        <span className="ml-auto text-xs text-text-lo transition-colors group-hover:text-text-mid">
          {expanded ? "Hide" : "Show"}
        </span>
      </button>

      {expanded && (
        <Card noPadding className="overflow-hidden animate-fade-in">
          <div className="space-y-3 p-4">
            <div className="rounded-xl border border-border bg-surface-raised/40 px-3 py-2.5">
              <p className="text-xs font-medium text-text-hi">Quick wallet access</p>
              <p className="mt-1 text-[11px] text-text-lo">
                Save multiple wallets here, then tap any saved wallet below to load that portfolio instantly.
              </p>
            </div>

            {currentAddress && !isCurrentSaved && (
              <div className="rounded-xl border border-accent/20 bg-accent/5 p-3">
                <p className="text-xs font-medium text-accent">Save current wallet</p>
                <p className="mt-1 text-[11px] text-text-lo">
                  Add an optional label now, or leave it blank and rename it later.
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    placeholder="Main, Trading, DeFi, Long Term..."
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveCurrent()}
                    className="h-9 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-text-hi placeholder:text-text-lo focus:outline-none focus:border-accent/40"
                  />
                  <button
                    onClick={handleSaveCurrent}
                    className="h-9 rounded-lg bg-accent px-3 text-xs font-medium text-text-hi transition-colors hover:bg-accent-hover"
                  >
                    Save wallet
                  </button>
                </div>
              </div>
            )}

            {currentAddress && isCurrentSaved && (
              <div className="rounded-xl border border-success/20 bg-success/5 px-3 py-2.5">
                <p className="text-xs font-medium text-success">Current wallet is saved</p>
                <p className="mt-1 text-[11px] text-text-lo">
                  Tap any saved wallet below to switch portfolios.
                </p>
              </div>
            )}

            {wallets.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-text-lo">No saved wallets yet</p>
                <p className="mt-1 text-xs text-text-lo">Save this wallet first, then you can switch between portfolios from here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {wallets.map((wallet) => (
                  <WalletRow
                    key={wallet.address}
                    wallet={wallet}
                    isCurrent={sameTrackedAddress(wallet.address, currentAddress)}
                    onRemove={onRemove}
                    onRename={onRename}
                    onSwitch={onSwitch}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}