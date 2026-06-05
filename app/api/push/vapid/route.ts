import { NextResponse } from "next/server";
import { pushConfigured } from "@/lib/push/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Expose the VAPID public key + whether push is configured on the server. */
export async function GET() {
  return NextResponse.json({
    publicKey: process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
    configured: pushConfigured(),
  });
}
