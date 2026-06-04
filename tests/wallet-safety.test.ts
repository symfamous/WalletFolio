import test from "node:test";
import assert from "node:assert/strict";
import { buildWalletSafetySummary } from "../lib/walletSafety.ts";
import type { HistoryEvent } from "../types/index.ts";

function approval(overrides: Partial<HistoryEvent> = {}): HistoryEvent {
  return {
    id: "approve-1",
    type: "approve",
    description: "Approved USDC",
    chainSlug: "ethereum",
    chainName: "Ethereum",
    chainColor: "#000",
    chainEmoji: "",
    tokenSymbol: "USDC",
    counterparty: "0x123...abcd",
    txHash: "hash",
    timestamp: "2026-05-20T00:00:00.000Z",
    status: "confirmed",
    dataSource: "zerion",
    ...overrides,
  };
}

test("approval scanner identifies approvals without claiming active allowance", () => {
  const result = buildWalletSafetySummary([approval()], Date.parse("2026-05-27T00:00:00.000Z"));
  assert.equal(result.state, "Review");
  assert.equal(result.approvalCount, 1);
  assert.match(result.note, /does not query current active allowance/i);
});

test("approval scanner raises repeated or unknown spender approvals for attention", () => {
  const result = buildWalletSafetySummary([
    approval({ id: "a", counterparty: undefined }),
    approval({ id: "b", counterparty: undefined, timestamp: "2026-05-19T00:00:00.000Z" }),
  ]);
  assert.equal(result.state, "High Risk");
  assert.equal(result.findings[0].severity, "warning");
});
