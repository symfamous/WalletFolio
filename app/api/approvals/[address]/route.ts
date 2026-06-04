/**
 * app/api/approvals/[address]/route.ts
 *
 * Token approval / allowance security scan via GoPlus (free, no key).
 * Aggregates the address's active approvals across major chains and flags
 * unlimited / risky spenders so the user can revoke them.
 */
import { NextRequest, NextResponse } from "next/server";
import { isValidAddress } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHAINS: { id: string; name: string }[] = [
  { id: "1", name: "Ethereum" },
  { id: "8453", name: "Base" },
  { id: "42161", name: "Arbitrum" },
  { id: "10", name: "Optimism" },
  { id: "137", name: "Polygon" },
  { id: "56", name: "BNB Chain" },
];

interface GoPlusSpender {
  approved_contract?: string;
  approved_amount?: string;
  hash?: string;
  address_info?: {
    contract_name?: string;
    is_contract?: number;
    doubt_list?: number;
    malicious_behavior?: string[];
    trust_list?: number;
    is_open_source?: number;
  };
}
interface GoPlusToken {
  token_symbol?: string;
  token_address?: string;
  approved_list?: GoPlusSpender[];
}

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

async function scanChain(address: string, chain: { id: string; name: string }): Promise<ApprovalRow[]> {
  try {
    const res = await fetch(
      `https://api.gopluslabs.io/api/v2/token_approval_security/${chain.id}?addresses=${address}`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { code?: number; result?: GoPlusToken[] };
    const tokens = data.result ?? [];
    const rows: ApprovalRow[] = [];
    for (const t of tokens) {
      for (const sp of t.approved_list ?? []) {
        const info = sp.address_info ?? {};
        const isUnlimited = (sp.approved_amount ?? "").toLowerCase() === "unlimited";
        const malicious = (info.malicious_behavior?.length ?? 0) > 0 || info.doubt_list === 1;
        const risk: ApprovalRow["risk"] = malicious ? "danger" : isUnlimited ? "warning" : "ok";
        rows.push({
          chainId: chain.id,
          chainName: chain.name,
          tokenSymbol: t.token_symbol ?? "?",
          tokenAddress: t.token_address ?? "",
          spender: sp.approved_contract ?? "",
          spenderName: info.contract_name || "Unknown contract",
          amount: sp.approved_amount ?? "",
          isUnlimited,
          risk,
        });
      }
    }
    return rows;
  } catch {
    return [];
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address: raw } = await params;
  const address = raw.toLowerCase();
  if (!isValidAddress(address)) {
    return NextResponse.json({ error: "Invalid EVM address", approvals: [] }, { status: 400 });
  }

  const results = await Promise.all(CHAINS.map((c) => scanChain(address, c)));
  const approvals = results
    .flat()
    .sort((a, b) => {
      const order = { danger: 0, warning: 1, ok: 2 } as const;
      return order[a.risk] - order[b.risk];
    });

  return NextResponse.json(
    {
      approvals,
      counts: {
        total: approvals.length,
        danger: approvals.filter((a) => a.risk === "danger").length,
        unlimited: approvals.filter((a) => a.isUnlimited).length,
      },
    },
    { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=300" } }
  );
}
