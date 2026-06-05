import webpush from "web-push";
import { removeSubscription, type WebPushSubscription } from "./store";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:alerts@walletfolio.app";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Send a push to one subscription. Returns false (and prunes the subscription)
 * when the endpoint is gone (HTTP 404/410), so dead devices self-clean.
 */
export async function sendPush(subscription: WebPushSubscription, payload: PushPayload): Promise<boolean> {
  if (!ensureConfigured()) return false;
  try {
    await webpush.sendNotification(
      subscription as unknown as webpush.PushSubscription,
      JSON.stringify(payload)
    );
    return true;
  } catch (err) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await removeSubscription(subscription.endpoint).catch(() => {});
    }
    return false;
  }
}
