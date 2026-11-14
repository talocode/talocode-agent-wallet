import assert from "node:assert/strict";
import test from "node:test";
import { comparableLamports, decidePolicy, formatLamports, parseLamports, type PolicyInput } from "./policy.ts";

const policy: PolicyInput = {
  maxTxLamports: 5_000_000_000n,
  dailyLamports: 30_000_000_000n,
  monthlyLamports: 100_000_000_000n,
  approvedRecipients: ["Recipient111111111111111111111111111111111"],
  allowedTokens: ["SOL"],
  network: "solana-devnet",
  requireApproval: true,
  expiresAt: null,
  agentStatus: "active",
};

const base = {
  token: "SOL",
  network: "solana-devnet",
  amountLamports: 1_000_000_000n,
  recipient: "Recipient111111111111111111111111111111111",
  spentToday: 0n,
  spentMonth: 0n,
  now: new Date("2026-11-14T12:00:00Z"),
};

test("parses SOL amounts without floating point", () => {
  assert.equal(parseLamports("1.5", 9), 1_500_000_000n);
  assert.equal(formatLamports(1_500_000_000n, 9), "1.5");
  assert.throws(() => parseLamports("0", 9));
  assert.throws(() => parseLamports("1.1234567891", 9));
});

test("blocks a payment above the transaction cap", () => {
  const decision = decidePolicy(policy, { ...base, amountLamports: 6_000_000_000n });
  assert.equal(decision.ok, false);
});

test("blocks an unapproved recipient and an inactive agent", () => {
  assert.equal(decidePolicy(policy, { ...base, recipient: "Other" }).ok, false);
  assert.equal(decidePolicy({ ...policy, agentStatus: "paused" }, base).ok, false);
});

test("an in-policy payment still needs a signature", () => {
  const decision = decidePolicy(policy, base);
  assert.equal(decision.ok, true);
  if (decision.ok) assert.equal(decision.needsSignature, true);
});

test("one USDC counts as one SOL against a SOL-denominated cap", () => {
  assert.equal(comparableLamports("USDC", 1_000_000n), 1_000_000_000n);
  assert.equal(comparableLamports("SOL", 5n), 5n);
});

test("daily spend includes the new amount", () => {
  const decision = decidePolicy(policy, { ...base, spentToday: 29_500_000_000n });
  assert.equal(decision.ok, false);
});
