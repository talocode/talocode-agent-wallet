import assert from "node:assert/strict";
import test from "node:test";

const base = process.env.WALLET_TEST_BASE ?? "http://127.0.0.1:8080";

test("the API rejects a missing key and a bad key", async () => {
  const missing = await fetch(`${base}/api/v1/agents`);
  assert.equal(missing.status, 401);
  const missingBody = await missing.json();
  assert.match(missingBody.error.message, /Bearer/);

  const bad = await fetch(`${base}/api/v1/network`, {
    headers: { authorization: "Bearer tk_not-a-real-key" },
  });
  assert.equal(bad.status, 401);

  const preflight = await fetch(`${base}/api/v1/agents`, {
    method: "OPTIONS",
    headers: {
      origin: "https://example.com",
      "access-control-request-method": "POST",
      "access-control-request-headers": "authorization, content-type, idempotency-key",
    },
  });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get("access-control-allow-headers") ?? "", /authorization/i);
});

test("the API refuses an oversized body", async () => {
  const response = await fetch(`${base}/api/v1/agents`, {
    method: "POST",
    headers: {
      authorization: "Bearer tk_not-a-real-key",
      "content-type": "application/json",
    },
    body: JSON.stringify({ name: "x".repeat(21_000) }),
  });
  assert.equal(response.status, 400);
});
