"use client";

import { useState, useRef } from "react";
import { Search, X, ClipboardPaste, Loader2, ArrowRight } from "lucide-react";
import { cn, validateAddress, detectChain, isSolanaAddress } from "@/lib/utils";

interface AddressInputProps {
  onSubmit:   (address: string) => void;
  isLoading?: boolean;
  className?: string;
}

const CHAIN_BADGE: Record<"evm" | "solana", { label: string; color: string; bg: string }> = {
  evm:    { label: "EVM",    color: "rgb(var(--accent))", bg: "rgb(var(--accent) / 0.1)"  },
  solana: { label: "SOL",   color: "#9945FF", bg: "rgb(153 69 255 / 0.12)" },
};

export function AddressInput({ onSubmit, isLoading = false, className }: AddressInputProps) {
  const [value,  setValue]  = useState("");
  const [error,  setError]  = useState<string | null>(null);
  const [pasted, setPasted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const chain   = value.length > 4 ? detectChain(value.trim()) : null;
  const isValid = value.length > 0 && !validateAddress(value.trim());

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value);
    if (error) setError(null);
  }

  function submit(raw: string) {
    const trimmed = raw.trim();
    const msg = validateAddress(trimmed);
    if (msg) { setError(msg); return; }
    setError(null);
    // Preserve case for Solana; lowercase for EVM
    const normalised = (isSolanaAddress(trimmed) && !trimmed.startsWith("0x"))
      ? trimmed
      : trimmed.toLowerCase();
    onSubmit(normalised);
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    submit(value);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSubmit();
  }

  function handleClear() {
    setValue("");
    setError(null);
    inputRef.current?.focus();
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      setValue(trimmed);
      setError(null);
      setPasted(true);
      setTimeout(() => setPasted(false), 1500);
      if (!validateAddress(trimmed)) submit(trimmed);
    } catch {
      inputRef.current?.focus();
    }
  }

  const hasValue = value.length > 0;
  const badge    = chain ? CHAIN_BADGE[chain] : null;

  return (
    <form onSubmit={handleSubmit} className={cn("w-full", className)}>
      <div
        className={cn(
          "relative flex items-center rounded-xl border transition-all duration-200",
          "shadow-[0_10px_24px_rgba(0,0,0,0.1)]",
          error
            ? "border-danger/50 bg-danger/5"
            : isValid
            ? "border-accent/34 bg-accent/[0.05]"
            : "border-text-hi/[0.08] hover:border-text-hi/[0.12] focus-within:border-accent/28"
        )}
        style={!error && !isValid ? {
          background: "linear-gradient(180deg, rgb(var(--text-hi) / 0.025), rgb(var(--text-hi) / 0.015))",
        } : undefined}
      >
        {/* Search icon */}
        <div className="pl-4 flex-shrink-0">
          <Search className="h-4 w-4 text-text-lo" strokeWidth={1.5} />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="0x… EVM  or  Solana base58 address"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          disabled={isLoading}
          className={cn(
            "flex-1 bg-transparent px-3 py-3.5 text-[14px] font-mono",
            "text-text-hi placeholder:text-text-lo",
            "focus:outline-none disabled:opacity-60 min-w-0"
          )}
        />

        {/* Chain badge — shown when chain is detected */}
        {badge && (
          <div
            className="flex-shrink-0 mr-1 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-widest"
            style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.color}30` }}
          >
            {badge.label}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 pr-2 flex-shrink-0">
          {!hasValue && (
            <button
              type="button"
              onClick={handlePaste}
              title="Paste from clipboard"
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors",
                pasted
                  ? "text-success bg-success/10"
                  : "text-text-lo hover:text-text-mid hover:bg-text-hi/[0.03]"
              )}
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{pasted ? "Pasted!" : "Paste"}</span>
            </button>
          )}

          {hasValue && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              title="Clear"
              className="rounded-lg p-1.5 text-text-lo transition-colors hover:bg-text-hi/[0.03] hover:text-text-mid"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <button
            type="submit"
            disabled={!hasValue || isLoading}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              hasValue && !isLoading
                ? "bg-accent text-white hover:bg-accent-hover"
                : "bg-surface-raised text-text-lo cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="hidden sm:inline">Loading…</span>
              </>
            ) : (
              <>
                <ArrowRight className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Track</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Helper text — shown when no input */}
      {!hasValue && !error && (
        <p className="mt-2 text-[11px] text-text-lo pl-1">
          Supports EVM chains (0x…) and Solana (base58) wallets
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="mt-2 text-xs text-danger animate-fade-in pl-1">{error}</p>
      )}
    </form>
  );
}
