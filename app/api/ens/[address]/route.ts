/**
 * app/api/ens/[address]/route.ts
 * Reverse-resolve an address to its ENS name + avatar (ensideas, free, no key).
 */
import { NextRequest, NextResponse } from "next/server";
import { isValidAddress } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address: raw } = await params;
  const address = raw.toLowerCase();
  if (!isValidAddress(address)) return NextResponse.json({ name: null, avatar: null });
  try {
    const res = await fetch(`https://api.ensideas.com/ens/resolve/${address}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return NextResponse.json({ name: null, avatar: null });
    const data = (await res.json()) as { name?: string | null; avatar?: string | null };
    return NextResponse.json(
      { name: data.name ?? null, avatar: data.avatar ?? null },
      { headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400" } }
    );
  } catch {
    return NextResponse.json({ name: null, avatar: null });
  }
}
