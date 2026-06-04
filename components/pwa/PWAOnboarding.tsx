"use client";

import { AddressInput } from "@/components/AddressInput";

interface PWAOnboardingProps {
  onSubmit: (address: string) => void;
  isLoading?: boolean;
}

export function PWAOnboarding({ onSubmit, isLoading }: PWAOnboardingProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-6 animate-fade-up">
      <p className="text-sm font-medium text-text-hi mb-4 text-center">
        Enter a wallet address to get started
      </p>
      <div className="w-full max-w-md">
        <AddressInput onSubmit={onSubmit} isLoading={isLoading} />
      </div>
      <p className="mt-3 text-[11px] text-text-lo text-center">
        Read-only · No wallet connection needed
      </p>
    </div>
  );
}