import { NextRequest, NextResponse } from "next/server";
import { listSubscriptions, markNotified, pushConfigured } from "@/lib/push/store";
import { sendPush } from "@/lib/push/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COOLDOWN_MS = 12 * 60 * 60 * 1000; // don't re-notify the same device within 12h

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev convenience when no secret is set
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

interface PortfolioSummaryLite {
  totalUsdValue: number;
  change24h?: number;
}

async function fetchSummary(origin: string, address: string): Promise<PortfolioSummaryLite | null> {
  try {
    const res = await fetch(`${origin}/api/portfolio/${address}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { portfolio?: { summary?: PortfolioSummaryLite } };
    return json.portfolio?.summary ?? null;
  } catch {
    return null;
  }
}

function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export async function GET(req: NextRequest) {
  if (!pushConfigured()) return NextResponse.json({ error: "Push not configured." }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const origin = new URL(req.url).origin;
  const subs = await listSubscriptions();
  if (subs.length === 0) return NextResponse.json({ checked: 0, sent: 0 });

  // One portfolio fetch per unique address.
  const byAddress = new Map<string, PortfolioSummaryLite | null>();
  await Promise.all(
    [...new Set(subs.map((s) => s.address))].map(async (addr) => {
      byAddress.set(addr, await fetchSummary(origin, addr));
    })
  );

  const now = Date.now();
  let sent = 0;

  await Promise.all(subs.map(async (sub) => {
    const summary = byAddress.get(sub.address);
    if (!summary || summary.change24h === undefined) return;
    if (Math.abs(summary.change24h) < sub.threshold) return;
    if (sub.lastNotifiedAt && now - sub.lastNotifiedAt < COOLDOWN_MS) return;

    const up = summary.change24h >= 0;
    const ok = await sendPush(sub.subscription, {
      title: `Portfolio ${up ? "up" : "down"} ${Math.abs(summary.change24h).toFixed(1)}% (24h)`,
      body: `${sub.address.slice(0, 6)}…${sub.address.slice(-4)} is now ${fmtUsd(summary.totalUsdValue)}.`,
      url: "/",
      tag: `move-${sub.address}`,
    });
    if (ok) {
      sent += 1;
      await markNotified(sub.subscription.endpoint, now);
    }
  }));

  return NextResponse.json({ checked: subs.length, sent });
}
