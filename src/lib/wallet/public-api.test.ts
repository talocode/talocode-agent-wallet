import assert from "node:assert/strict";
import test from "node:test";
import { publicCapabilities, publicHealth } from "./public-api.ts";

test("public health does not pretend to reach Devnet", () => {
  const health = publicHealth();
  assert.equal(health.ok, true);
  assert.equal(health.package, "@talocode/agent-wallet");
  assert.equal(health.network, "solana-devnet");
  assert.match(health.note, /No API key/);
  assert.equal("slot" in health, false);
});

test("capabilities name the four surfaces and refuse signing", () => {
  const catalog = publicCapabilities();
  assert.deepEqual(catalog.surfaces, ["npm", "cli", "sdk", "mcp", "api"]);
  assert.ok(catalog.public.includes("GET /api/v1/health"));
  assert.ok(catalog.authenticated.includes("POST /api/v1/transactions"));
  assert.ok(catalog.cannot.includes("sign a transaction"));
});
