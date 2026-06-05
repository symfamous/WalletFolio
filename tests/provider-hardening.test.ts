import test from "node:test";
import assert from "node:assert/strict";
import {
  ProviderRequestError,
  classifyProviderError,
  getProviderHealth,
  getProviderRetryRules,
  getProviderTimeoutMs,
  isProviderEnabled,
  providerFetch,
  resetProviderHealth,
} from "../lib/providers/resilience.ts";

function installFetchMock(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> | Response
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handler(input, init))) as typeof globalThis.fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void> | void) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(vars)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of previous.entries()) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

function makeJsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function makeDelayedAbortResponse(delayMs = 5): Promise<Response> {
  return new Promise<Response>((_resolve, reject) => {
    setTimeout(() => {
      reject(new DOMException("The operation was aborted.", "AbortError"));
    }, delayMs);
  });
}

test("timeout provider does not block the request budget", async () => {
  resetProviderHealth();
  const restoreFetch = installFetchMock(() => makeDelayedAbortResponse(25));

  const started = Date.now();
  await assert.rejects(
    providerFetch("zapper", "https://example.com/slow", undefined, {
      timeoutMs: 30,
      retries: {},
    }),
    (error: unknown) => error instanceof ProviderRequestError && error.reason === "timeout"
  );
  const elapsed = Date.now() - started;
  restoreFetch();

  assert.ok(elapsed < 200, `expected a fast timeout, got ${elapsed} ms`);
});

test("timeout is classified separately from rate limit", () => {
  const timeoutError = classifyProviderError("zapper", new DOMException("The operation was aborted.", "AbortError"), 25);
  assert.equal(timeoutError.reason, "timeout");
  assert.equal(timeoutError.message.includes("rate limited"), false);
});

test("actual HTTP 429 is classified as rate limit", async () => {
  resetProviderHealth();
  const restoreFetch = installFetchMock(() => new Response("Too Many Requests", { status: 429 }));

  await assert.rejects(
    providerFetch("zapper", "https://example.com/rate-limit", undefined, { retries: {} }),
    (error: unknown) => error instanceof ProviderRequestError && error.reason === "rate_limit"
  );

  restoreFetch();
});

test("circuit breaker opens after repeated timeout failures", async () => {
  resetProviderHealth();
  const restoreFetch = installFetchMock(() => makeDelayedAbortResponse(5));

  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(
      providerFetch("moralis", "https://example.com/moralis", undefined, {
        timeoutMs: 20,
        retries: {},
        failureThreshold: 2,
        cooldownMs: 1_000,
      })
    );
  }

  restoreFetch();
  const health = getProviderHealth("moralis");
  assert.equal(health.state, "open_circuit");
  assert.equal(health.failureCount, 2);
});

test("open circuit provider is skipped during cooldown", async () => {
  resetProviderHealth();
  let fetchCalls = 0;
  const restoreFetch = installFetchMock(() => {
    fetchCalls += 1;
    return makeDelayedAbortResponse(5);
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(
      providerFetch("moralis", "https://example.com/moralis", undefined, {
        timeoutMs: 20,
        retries: {},
        failureThreshold: 2,
        cooldownMs: 10_000,
      })
    );
  }

  await assert.rejects(
    providerFetch("moralis", "https://example.com/moralis", undefined, {
      timeoutMs: 20,
      retries: {},
      failureThreshold: 2,
      cooldownMs: 10_000,
    }),
    (error: unknown) => error instanceof ProviderRequestError && error.reason === "circuit_open"
  );

  restoreFetch();
  assert.equal(fetchCalls, 2);
});

test("provider recovers after cooldown expires", async () => {
  resetProviderHealth();
  const originalNow = Date.now;
  let now = 1_000;
  Date.now = () => now;

  let fetchCalls = 0;
  const restoreFetch = installFetchMock(() => {
    fetchCalls += 1;
    if (fetchCalls <= 2) return makeDelayedAbortResponse(5);
    return makeJsonResponse({ ok: true });
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(
      providerFetch("moralis", "https://example.com/moralis", undefined, {
        timeoutMs: 20,
        retries: {},
        failureThreshold: 2,
        cooldownMs: 500,
      })
    );
  }

  now += 600;
  const response = await providerFetch("moralis", "https://example.com/moralis", undefined, {
    timeoutMs: 20,
    retries: {},
    failureThreshold: 2,
    cooldownMs: 500,
  });

  restoreFetch();
  Date.now = originalNow;

  assert.equal(response.status, 200);
  assert.equal(getProviderHealth("moralis").state, "healthy");
});

test("timeout failures do not retry endlessly", async () => {
  resetProviderHealth();
  let fetchCalls = 0;
  const restoreFetch = installFetchMock(() => {
    fetchCalls += 1;
    return makeDelayedAbortResponse(5);
  });

  await assert.rejects(
    providerFetch("zapper", "https://example.com/no-retry-timeout", undefined, {
      timeoutMs: 20,
      retries: {},
    }),
    (error: unknown) => error instanceof ProviderRequestError && error.reason === "timeout"
  );
  restoreFetch();

  assert.equal(fetchCalls, 1);
});

test("disabled provider env flag skips provider cleanly", async () => {
  resetProviderHealth();

  await withEnv({ ENABLE_ZAPPER: "false" }, async () => {
    let fetchCalls = 0;
    const restoreFetch = installFetchMock(() => {
      fetchCalls += 1;
      return makeJsonResponse({});
    });

    await assert.rejects(
      providerFetch("zapper", "https://example.com/disabled", undefined, { retries: {} }),
      (error: unknown) => error instanceof ProviderRequestError && error.reason === "disabled"
    );

    restoreFetch();
    assert.equal(fetchCalls, 0);
  });
});

test("unknown errors are not mislabeled as rate limits", () => {
  const error = classifyProviderError("moralis", new Error("socket hang up"), 25);
  assert.equal(error.reason, "network");
  assert.equal(error.message.includes("rate limited"), false);
});

test("successful response resets provider health after earlier timeout", async () => {
  resetProviderHealth();
  let callCount = 0;
  const restoreFetch = installFetchMock(() => {
    callCount += 1;
    if (callCount === 1) {
      return makeDelayedAbortResponse(5);
    }
    return makeJsonResponse({ ok: true });
  });

  await assert.rejects(
    providerFetch("zapper", "https://example.com/recover", undefined, {
      timeoutMs: 20,
      retries: {},
      failureThreshold: 3,
      cooldownMs: 1_000,
    })
  );

  const response = await providerFetch("zapper", "https://example.com/recover", undefined, {
    timeoutMs: 20,
    retries: {},
    failureThreshold: 3,
    cooldownMs: 1_000,
  });
  restoreFetch();

  assert.equal(response.status, 200);
  assert.equal(getProviderHealth("zapper").state, "healthy");
});

test("rate limits retry once and then succeed", async () => {
  resetProviderHealth();
  let fetchCalls = 0;
  const restoreFetch = installFetchMock(() => {
    fetchCalls += 1;
    if (fetchCalls === 1) {
      return new Response("Too Many Requests", { status: 429 });
    }
    return makeJsonResponse({ ok: true });
  });

  const response = await providerFetch("zapper", "https://example.com/retry-rate-limit", undefined, {
    timeoutMs: 20,
    retries: { rate_limit: 1 },
  });
  restoreFetch();

  assert.equal(response.status, 200);
  assert.equal(fetchCalls, 2);
});

test("server errors can retry once without being treated as rate limits", async () => {
  resetProviderHealth();
  let fetchCalls = 0;
  const restoreFetch = installFetchMock(() => {
    fetchCalls += 1;
    if (fetchCalls === 1) return new Response("bad gateway", { status: 502 });
    return makeJsonResponse({ ok: true });
  });

  const response = await providerFetch("hyperliquid", "https://example.com/server-retry", undefined, {
    timeoutMs: 20,
    retries: { server_error: 1 },
  });
  restoreFetch();

  assert.equal(response.status, 200);
  assert.equal(fetchCalls, 2);
});

test("Hyperliquid timeout stays above the regressed 2200ms budget", () => {
  assert.ok(getProviderTimeoutMs("hyperliquid") > 2_200);
});

test("Zerion retries transient timeout and network failures once before degrading", () => {
  const retryRules = getProviderRetryRules("zerion");
  assert.equal(retryRules.timeout, 1);
  assert.equal(retryRules.network, 1);
});

test("Zerion timeout is raised for primary-provider survivability", () => {
  assert.ok(getProviderTimeoutMs("zerion") >= 7_000);
});

test("Zerion keeps a single retry for transient timeout and network errors", () => {
  const retryRules = getProviderRetryRules("zerion");
  assert.equal(retryRules.timeout, 1);
  assert.equal(retryRules.network, 1);
});

test("secondary fallback providers stay enabled in development when not explicitly disabled", async () => {
  await withEnv({ NODE_ENV: "development", ENABLE_ZAPPER: undefined }, async () => {
    assert.equal(isProviderEnabled("zapper"), true);
  });

  await withEnv({ NODE_ENV: "production", ENABLE_ZAPPER: undefined }, async () => {
    assert.equal(isProviderEnabled("zapper"), true);
  });
});
