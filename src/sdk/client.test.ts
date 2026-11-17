import assert from "node:assert/strict";
import test from "node:test";
import { Talocode, TalocodeError } from "./client.ts";

test("sends the bearer key and surfaces API errors", async () => {
  const calls: Array<{ url: string; authorization: string }> = [];
  const client = new Talocode({
    apiKey: "tk_example",
    baseUrl: "https://agent.example",
    fetchImpl: async (input, init) => {
      const url = String(input);
      calls.push({ url, authorization: String(new Headers(init?.headers).get("authorization")) });
      if (url.endsWith("/missing")) {
        return new Response(JSON.stringify({ error: { message: "Agent not found." } }), { status: 404 });
      }
      return new Response(JSON.stringify({ agents: [] }), { status: 200 });
    },
  });
  const listed = await client.agents.list();
  assert.deepEqual(listed.agents, []);
  assert.equal(calls[0]?.authorization, "Bearer tk_example");
  assert.equal(calls[0]?.url, "https://agent.example/api/v1/agents");
  await assert.rejects(() => client.agents.get("missing"), (error: unknown) => {
    assert.ok(error instanceof TalocodeError);
    assert.equal(error.status, 404);
    return true;
  });
});

test("refuses an empty API key on an authed call, and health stays public", async () => {
  const client = new Talocode({ baseUrl: "https://agent.example" });
  await assert.rejects(() => client.agents.list(), /apiKey is required/);
  const calls: string[] = [];
  const open = new Talocode({
    baseUrl: "https://agent.example/agent-wallet",
    fetchImpl: async (input, init) => {
      calls.push(String(input));
      assert.equal(new Headers(init?.headers).get("authorization"), null);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  });
  const health = await open.health();
  assert.equal(health.ok, true);
  assert.equal(calls[0], "https://agent.example/agent-wallet/api/v1/health");
});
