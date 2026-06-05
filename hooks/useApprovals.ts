"use client";

import { useQuery } from "@tanstack/react-query";
import { normalizeTrackedAddress } from "@/lib/utils";

export interface ApprovalRow {
  chainId: string;
  chainName: string;
  tokenSymbol: string;
  tokenAddress: string;
  spender: string;
  spenderName: string;
  amount: string;
  isUnlimited: boolean;
  risk: "danger" | "warning" | "ok";
}

interface ApprovalsResponse {
  approvals: ApprovalRow[];
  counts: { total: number; danger: number; unlimited: number };
}

export function useApprovals(address: string | undefined) {
  return useQuery<ApprovalsResponse, Error>({
    queryKey: ["approvals", address ? normalizeTrackedAddress(address) : undefined],
    queryFn: async () => {
      const res = await fetch(`/api/approvals/${normalizeTrackedAddress(address!)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<ApprovalsResponse>;
    },
    enabled: Boolean(address),
    staleTime: 2 * 60_000,
  });
}
