"use client";

import { Wallet2, ArrowDown } from "lucide-react";
import { AddressInput } from "@/components/AddressInput";

interface EmptyStateProps {
  onSubmit: (address: string) => void;
}

export function EmptyState({ onSubmit }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 animate-fade-up">
      <div className="relative mb-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10">
          <Wallet2 className="h-9 w-9 text-accent" strokeWidth={1.2} />
        </div>
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-accent/5 blur-2xl scale-[1.6]" />
      </div>

      <h2 className="mb-2 text-2xl font-semibold tracking-tight text-text-hi sm:text-3xl text-center">
        Paste a wallet address to start
      </h2>
      <p className="mb-8 max-w-sm text-center text-[15px] text-text-mid leading-relaxed">
        See token balances and DeFi positions across all supported EVM chains.
        No wallet connection required.
      </p>

      <ArrowDown className="h-4 w-4 text-text-lo mb-4 animate-bounce" />
      <div className="w-full max-w-lg">
        <AddressInput onSubmit={onSubmit} />
      </div>

      <p className="mt-5 text-xs text-text-lo text-center">
        Read-only · Address never stored
      </p>
    </div>
  );
}
