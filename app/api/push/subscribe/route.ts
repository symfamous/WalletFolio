import { NextRequest, NextResponse } from "next/server";
import { pushConfigured, saveSubscription, type WebPushSubscription } from "@/lib/push/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!pushConfigured()) {
    return NextResponse.json({ error: "Push is not configured on the server." }, { status: 503 });
  }

  let body: { subscription?: WebPushSubscription; address?: string; threshold?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const subscription = body.subscription;
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
  }
  const address = (body.address ?? "").trim().toLowerCase();
  if (!address) return NextResponse.json({ error: "Missing wallet address." }, { status: 400 });

  const threshold = typeof body.threshold === "number" && body.threshold > 0 ? body.threshold : 5;

  const ok = await saveSubscription({
    subscription: { endpoint: subscription.endpoint, keys: subscription.keys },
    address,
    threshold,
    createdAt: Date.now(),
  });

  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Could not store subscription." }, { status: 500 });
}
