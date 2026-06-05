"use client";

import { useQuery } from "@tanstack/react-query";
import { isValidAddress, normalizeTrackedAddress } from "@/lib/utils";

export function useEns(address: string | undefined) {
  return useQuery<{ name: string | null; avatar: string | null }, Error>({
    queryKey: ["ens", address ? normalizeTrackedAddress(address) : undefined],
    queryFn: async () => {
      const res = await fetch(`/api/ens/${normalizeTrackedAddress(address!)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: Boolean(address) && isValidAddress(address ?? ""),
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
  });
}
