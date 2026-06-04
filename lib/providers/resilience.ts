type ProviderName =
  | "zerion"
  | "zerion_history"
  | "zerion_chains"
  | "zapper"
  | "moralis"
  | "covalent"
  | "hyperliquid"
  | "dydx"
  | "etherscan"
  | "gmx";

export type ProviderFailureReason =
  | "timeout"
  | "rate_limit"
  | "network"
  | "server_error"
  | "http_error"
  | "disabled"
  | "circuit_open"
  | "unknown";

export interface ProviderHealthState {
  provider: string;
  state: "healthy" | "degraded" | "open_circuit";
  failureCount: number;
  lastFailureAt: number;
  retryAfterAt?: number;
  lastReason?: ProviderFailureReason;
}

interface ProviderPolicy {
  timeoutMs: number;
  retries: Partial<Record<ProviderFailureReason, number>>;
  failureThreshold: number;
  cooldownMs: number;
  enabledEnv?: string;
  defaultEnabledInDev?: boolean;
}

const DEFAULT_POLICY: ProviderPolicy = {
  timeoutMs: 3_000,
  retries: {
    rate_limit: 1,
    server_error: 1,
  },
  failureThreshold: 2,
  cooldownMs: 60_000,
};

const PROVIDER_POLICIES: Record<ProviderName, ProviderPolicy> = {
  zerion: {
    timeoutMs: 8_000,
    retries: { rate_limit: 1, server_error: 1, timeout: 1, network: 1 },
    failureThreshold: 3,
    cooldownMs: 60_000,
    enabledEnv: "ENABLE_ZERION",
  },
  zerion_history: {
    timeoutMs: 3_000,
    retries: { rate_limit: 1 },
    failureThreshold: 2,
    cooldownMs: 60_000,
    enabledEnv: "ENABLE_ZERION",
  },
  zerion_chains: {
    timeoutMs: 1_500,
    retries: {},
    failureThreshold: 2,
    cooldownMs: 120_000,
    enabledEnv: "ENABLE_ZERION",
  },
  zapper: {
    timeoutMs: 2_500,
    retries: { rate_limit: 1, server_error: 1 },
    failureThreshold: 2,
    cooldownMs: 60_000,
    enabledEnv: "ENABLE_ZAPPER",
    defaultEnabledInDev: true,
  },
  moralis: {
    timeoutMs: 2_500,
    retries: {},
    failureThreshold: 2,
    cooldownMs: 60_000,
    enabledEnv: "ENABLE_MORALIS",
    defaultEnabledInDev: true,
  },
  covalent: {
    timeoutMs: 2_500,
    retries: { rate_limit: 1 },
    failureThreshold: 2,
    cooldownMs: 90_000,
    enabledEnv: "ENABLE_COVALENT",
    defaultEnabledInDev: true,
  },
  hyperliquid: {
    timeoutMs: 8_000,
    retries: { server_error: 1, network: 1 },
    failureThreshold: Number.MAX_SAFE_INTEGER,
    cooldownMs: 0,
  },
  dydx: {
    timeoutMs: 3_500,
    retries: {},
    failureThreshold: 2,
    cooldownMs: 60_000,
    enabledEnv: "ENABLE_DYDX",
    defaultEnabledInDev: true,
  },
  etherscan: {
    timeoutMs: 2_500,
    retries: {},
    failureThreshold: 3,
    cooldownMs: 45_000,
  },
  gmx: {
    timeoutMs: 3_000,
    retries: {},
    failureThreshold: 2,
    cooldownMs: 60_000,
  },
};

const providerHealth = new Map<string, ProviderHealthState>();
const onceLogs = new Set<string>();

export class ProviderRequestError extends Error {
  provider: string;
  reason: ProviderFailureReason;
  status?: number;
  timeoutMs?: number;
  retryAfterMs?: number;

  constructor(
    provider: string,
    reason: ProviderFailureReason,
    message: string,
    options?: {
      status?: number;
      timeoutMs?: number;
      retryAfterMs?: number;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = "ProviderRequestError";
    this.provider = provider;
    this.reason = reason;
    this.status = options?.status;
    this.timeoutMs = options?.timeoutMs;
    this.retryAfterMs = options?.retryAfterMs;
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

function policyFor(provider: ProviderName, override?: Partial<ProviderPolicy>): ProviderPolicy {
  return {
    ...DEFAULT_POLICY,
    ...PROVIDER_POLICIES[provider],
    ...override,
    retries: {
      ...DEFAULT_POLICY.retries,
      ...PROVIDER_POLICIES[provider].retries,
      ...override?.retries,
    },
  };
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value == null || value === "") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

export function isProviderEnabled(provider: ProviderName): boolean {
  const policy = PROVIDER_POLICIES[provider];
  const envName = policy.enabledEnv;
  if (!envName) return true;
  const configured = parseBooleanEnv(process.env[envName]);
  if (configured !== undefined) return configured;
  if (process.env.NODE_ENV === "development" && policy.defaultEnabledInDev !== undefined) {
    return policy.defaultEnabledInDev;
  }
  return true;
}

export function getProviderEnabledEnv(provider: ProviderName): string | undefined {
  return PROVIDER_POLICIES[provider].enabledEnv;
}

export function getProviderTimeoutMs(provider: ProviderName): number {
  return PROVIDER_POLICIES[provider].timeoutMs;
}

export function getProviderRetryRules(provider: ProviderName): Partial<Record<ProviderFailureReason, number>> {
  return { ...PROVIDER_POLICIES[provider].retries };
}

export function resetProviderHealth(): void {
  providerHealth.clear();
  onceLogs.clear();
}

export function getProviderHealth(provider: string, now = Date.now()): ProviderHealthState {
  const current = providerHealth.get(provider);
  if (!current) {
    return {
      provider,
      state: "healthy",
      failureCount: 0,
      lastFailureAt: 0,
    };
  }

  if (current.state === "open_circuit" && current.retryAfterAt && current.retryAfterAt <= now) {
    const healed: ProviderHealthState = {
      provider,
      state: "degraded",
      failureCount: 0,
      lastFailureAt: current.lastFailureAt,
      lastReason: current.lastReason,
    };
    providerHealth.set(provider, healed);
    return healed;
  }

  return current;
}

export function recordProviderSuccess(provider: string): void {
  providerHealth.set(provider, {
    provider,
    state: "healthy",
    failureCount: 0,
    lastFailureAt: Date.now(),
  });
}

export function recordProviderFailure(
  provider: string,
  reason: ProviderFailureReason,
  options?: { failureThreshold?: number; cooldownMs?: number }
): ProviderHealthState {
  const previous = getProviderHealth(provider);
  const failureCount = previous.failureCount + 1;
  const failureThreshold = options?.failureThreshold ?? DEFAULT_POLICY.failureThreshold;
  const cooldownMs = options?.cooldownMs ?? DEFAULT_POLICY.cooldownMs;
  const now = Date.now();

  const next: ProviderHealthState = {
    provider,
    state: failureCount >= failureThreshold ? "open_circuit" : "degraded",
    failureCount,
    lastFailureAt: now,
    lastReason: reason,
    retryAfterAt: failureCount >= failureThreshold ? now + cooldownMs : undefined,
  };

  providerHealth.set(provider, next);
  return next;
}

export function getCircuitOpenError(provider: string, retryAfterAt?: number): ProviderRequestError {
  const retryAfterMs = retryAfterAt ? Math.max(0, retryAfterAt - Date.now()) : undefined;
  return new ProviderRequestError(
    provider,
    "circuit_open",
    `[${provider}] circuit open, skipped`,
    { retryAfterMs }
  );
}

export function logProviderEventOnce(key: string, message: string): void {
  if (onceLogs.has(key)) return;
  onceLogs.add(key);
  console.info(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mergeSignals(signalA?: AbortSignal, signalB?: AbortSignal): AbortSignal | undefined {
  if (!signalA) return signalB;
  if (!signalB) return signalA;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([signalA, signalB]);
  }

  const ctrl = new AbortController();
  const abort = () => ctrl.abort();
  signalA.addEventListener("abort", abort, { once: true });
  signalB.addEventListener("abort", abort, { once: true });
  return ctrl.signal;
}

export function classifyProviderError(
  provider: string,
  error: unknown,
  timeoutMs?: number
): ProviderRequestError {
  if (error instanceof ProviderRequestError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (
    lower.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests")
  ) {
    return new ProviderRequestError(provider, "rate_limit", `[${provider}] rate limited`, {
      timeoutMs,
      cause: error,
    });
  }

  if (
    error instanceof DOMException && error.name === "AbortError" ||
    lower.includes("aborted") ||
    lower.includes("aborterror") ||
    lower.includes("etimedout") ||
    lower.includes("timeout")
  ) {
    return new ProviderRequestError(
      provider,
      "timeout",
      `[${provider}] timeout after ${timeoutMs ?? 0} ms`,
      { timeoutMs, cause: error }
    );
  }

  if (
    lower.includes("fetch failed") ||
    lower.includes("econnreset") ||
    lower.includes("enotfound") ||
    lower.includes("econnrefused") ||
    lower.includes("socket") ||
    lower.includes("network")
  ) {
    return new ProviderRequestError(provider, "network", `[${provider}] network error`, {
      timeoutMs,
      cause: error,
    });
  }

  return new ProviderRequestError(provider, "unknown", `[${provider}] ${message}`, {
    timeoutMs,
    cause: error,
  });
}

export function classifyHttpStatus(provider: string, status: number, bodyPreview?: string): ProviderRequestError {
  if (status === 429) {
    return new ProviderRequestError(
      provider,
      "rate_limit",
      `[${provider}] rate limited${bodyPreview ? `: ${bodyPreview}` : ""}`,
      { status }
    );
  }
  if (status >= 500) {
    return new ProviderRequestError(
      provider,
      "server_error",
      `[${provider}] server error HTTP ${status}${bodyPreview ? `: ${bodyPreview}` : ""}`,
      { status }
    );
  }
  return new ProviderRequestError(
    provider,
    "http_error",
    `[${provider}] HTTP ${status}${bodyPreview ? `: ${bodyPreview}` : ""}`,
    { status }
  );
}

function shouldRetry(
  policy: ProviderPolicy,
  reason: ProviderFailureReason,
  attempt: number
): boolean {
  return attempt < (policy.retries[reason] ?? 0);
}

function parseRetryAfterMs(headers: Headers): number | undefined {
  const retryAfter = headers.get("retry-after");
  if (!retryAfter) return undefined;

  const numericSeconds = Number(retryAfter);
  if (!Number.isNaN(numericSeconds) && numericSeconds >= 0) {
    return numericSeconds * 1000;
  }

  const dateMs = Date.parse(retryAfter);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return undefined;
}

function retryDelayMs(reason: ProviderFailureReason, attempt: number): number {
  if (reason === "rate_limit") return 5_000 * (attempt + 1);
  if (reason === "server_error") return 250 * (attempt + 1);
  if (reason === "timeout" || reason === "network") return 175 * (attempt + 1);
  return 0;
}

export async function providerFetch(
  provider: ProviderName,
  input: RequestInfo | URL,
  init?: RequestInit,
  override?: Partial<ProviderPolicy>
): Promise<Response> {
  const policy = policyFor(provider, override);

  if (!isProviderEnabled(provider)) {
    throw new ProviderRequestError(
      provider,
      "disabled",
      `[${provider}] disabled by ${policy.enabledEnv ?? "env"}`
    );
  }

  const health = getProviderHealth(provider);
  if (health.state === "open_circuit" && health.retryAfterAt && health.retryAfterAt > Date.now()) {
    throw getCircuitOpenError(provider, health.retryAfterAt);
  }

  for (let attempt = 0; ; attempt++) {
    try {
      const timeoutSignal = AbortSignal.timeout(policy.timeoutMs);
      const signal = mergeSignals(init?.signal ?? undefined, timeoutSignal);
      const res = await fetch(input, { ...init, signal });

      if (!res.ok) {
        const preview = await res.text().then((text) => text.slice(0, 160)).catch(() => "");
        const error = classifyHttpStatus(provider, res.status, preview);
        const retryAfterMs = res.status === 429 ? parseRetryAfterMs(res.headers) : undefined;
        if (retryAfterMs !== undefined) {
          error.retryAfterMs = retryAfterMs;
        }
        throw error;
      }

      recordProviderSuccess(provider);
      return res;
    } catch (rawError) {
      const error = classifyProviderError(provider, rawError, policy.timeoutMs);
      if (error.reason === "disabled" || error.reason === "circuit_open") {
        throw error;
      }

      if (shouldRetry(policy, error.reason, attempt)) {
        const delay = error.retryAfterMs ?? retryDelayMs(error.reason, attempt);
        if (delay > 0) {
          const retrySource = error.retryAfterMs !== undefined ? "Retry-After" : "policy";
          console.warn(`[${provider}] ${error.reason}, retrying in ${delay} ms (${retrySource})`);
          await sleep(delay);
        }
        continue;
      }

      const state = recordProviderFailure(provider, error.reason, {
        failureThreshold: policy.failureThreshold,
        cooldownMs: policy.cooldownMs,
      });

      if (state.state === "open_circuit") {
        console.warn(`[${provider}] ${error.reason}, opening circuit for ${policy.cooldownMs} ms`);
      }

      throw error;
    }
  }
}

export async function providerFetchJson<T>(
  provider: ProviderName,
  input: RequestInfo | URL,
  init?: RequestInit,
  override?: Partial<ProviderPolicy>
): Promise<T> {
  const res = await providerFetch(provider, input, init, override);
  return res.json() as Promise<T>;
}

export async function untrackedFetchJson<T>(
  provider: string,
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: { timeoutMs?: number }
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_POLICY.timeoutMs;
  try {
    const signal = mergeSignals(init?.signal ?? undefined, AbortSignal.timeout(timeoutMs));
    const res = await fetch(input, { ...init, signal });

    if (!res.ok) {
      const preview = await res.text().then((text) => text.slice(0, 160)).catch(() => "");
      throw classifyHttpStatus(provider, res.status, preview);
    }

    return res.json() as Promise<T>;
  } catch (rawError) {
    throw classifyProviderError(provider, rawError, timeoutMs);
  }
}

export async function runProviderTask<T>(
  provider: ProviderName,
  task: () => Promise<T>,
  override?: Partial<ProviderPolicy>
): Promise<T> {
  const policy = policyFor(provider, override);

  if (!isProviderEnabled(provider)) {
    throw new ProviderRequestError(
      provider,
      "disabled",
      `[${provider}] disabled by ${policy.enabledEnv ?? "env"}`
    );
  }

  const health = getProviderHealth(provider);
  if (health.state === "open_circuit" && health.retryAfterAt && health.retryAfterAt > Date.now()) {
    throw getCircuitOpenError(provider, health.retryAfterAt);
  }

  try {
    const result = await task();
    recordProviderSuccess(provider);
    return result;
  } catch (rawError) {
    const error = classifyProviderError(provider, rawError, policy.timeoutMs);
    recordProviderFailure(provider, error.reason, {
      failureThreshold: policy.failureThreshold,
      cooldownMs: policy.cooldownMs,
    });
    throw error;
  }
}
