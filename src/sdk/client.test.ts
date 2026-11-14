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

test("refuses an empty API key", () => {
  assert.throws(() => new Talocode({ apiKey: " ", baseUrl: "https://agent.example" }));
});
