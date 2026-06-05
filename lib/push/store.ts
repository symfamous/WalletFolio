import { Redis } from "@upstash/redis";

export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface StoredSubscription {
  subscription: WebPushSubscription;
  address: string;
  /** Min absolute 24h % move that should trigger a portfolio alert. */
  threshold: number;
  createdAt: number;
  lastNotifiedAt?: number;
}

const ENDPOINT_SET = "push:endpoints";
const subKey = (endpoint: string) => `push:sub:${endpoint}`;

let client: Redis | null = null;

/** Returns a Redis client, or null when Upstash env vars are not configured. */
export function getRedis(): Redis | null {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  client = new Redis({ url, token });
  return client;
}

export function pushConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN &&
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function saveSubscription(sub: StoredSubscription): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  await redis.set(subKey(sub.subscription.endpoint), sub);
  await redis.sadd(ENDPOINT_SET, sub.subscription.endpoint);
  return true;
}

export async function removeSubscription(endpoint: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  await redis.del(subKey(endpoint));
  await redis.srem(ENDPOINT_SET, endpoint);
  return true;
}

export async function listSubscriptions(): Promise<StoredSubscription[]> {
  const redis = getRedis();
  if (!redis) return [];
  const endpoints = await redis.smembers(ENDPOINT_SET);
  if (!endpoints || endpoints.length === 0) return [];
  const subs = await Promise.all(endpoints.map((e) => redis.get<StoredSubscription>(subKey(e))));
  return subs.filter((s): s is StoredSubscription => Boolean(s && s.subscription?.endpoint));
}

export async function markNotified(endpoint: string, at: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const existing = await redis.get<StoredSubscription>(subKey(endpoint));
  if (existing) await redis.set(subKey(endpoint), { ...existing, lastNotifiedAt: at });
}
