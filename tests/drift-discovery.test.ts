import test from "node:test";
import assert from "node:assert/strict";
import { hasDriftSignal } from "../lib/providers/perp_history/drift.ts";
import type { HeliusTx } from "../lib/providers/history/solana.ts";

const driftProgramId = "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsBNgYKgVQ7up";

function transaction(overrides: Partial<HeliusTx>): HeliusTx {
  return {
    signature: "sig",
    slot: 1,
    blockTime: 1,
    fee: 0,
    ...overrides,
  };
}

test("Drift detection finds CPI inner-instruction program invocations", () => {
  const tx = transaction({
    meta: {
      fee: 0,
      innerInstructions: [{ index: 0, instructions: [{ programId: driftProgramId }] }],
    },
  });
  assert.equal(hasDriftSignal(tx), true);
});

test("Drift detection finds program invocation logs", () => {
  const tx = transaction({
    meta: {
      fee: 0,
      logMessages: [`Program ${driftProgramId} invoke [2]`],
    },
  });
  assert.equal(hasDriftSignal(tx), true);
});
