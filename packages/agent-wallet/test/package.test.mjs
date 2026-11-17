import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { TalocodeAgentWallet, TalocodeError, joinUrl } from "../src/client.mjs";
import { run } from "../src/cli.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function fakeFetch(handler) {
  return async (input, init) => handler(String(input), init);
}

test("joinUrl keeps a base path", () => {
  assert.equal(
    joinUrl("https://talocode.site/agent-wallet", "/api/v1/health").href,
    "https://talocode.site/agent-wallet/api/v1/health",
  );
});

test("health does not send a bearer key", async () => {
  let authorization = "unset";
  const client = new TalocodeAgentWallet({
    baseUrl: "https://agent.example/agent-wallet",
    fetchImpl: fakeFetch((url, init) => {
      authorization = new Headers(init?.headers).get("authorization") ?? "";
      assert.equal(url, "https://agent.example/agent-wallet/api/v1/health");
      return new Response(JSON.stringify({ ok: true, service: "talocode-agent-wallet" }), { status: 200 });
    }),
  });
  const health = await client.health();
  assert.equal(health.ok, true);
  assert.equal(authorization, "");
});

test("authed calls require a key and surface API errors", async () => {
  const client = new TalocodeAgentWallet({
    baseUrl: "https://agent.example",
    fetchImpl: fakeFetch(() => new Response(JSON.stringify({ agents: [] }), { status: 200 })),
  });
  await assert.rejects(() => client.agents.list(), /apiKey is required/);

  const authed = new TalocodeAgentWallet({
    apiKey: "tk_example",
    baseUrl: "https://agent.example",
    fetchImpl: fakeFetch((url, init) => {
      assert.equal(new Headers(init.headers).get("authorization"), "Bearer tk_example");
      assert.equal(url, "https://agent.example/api/v1/agents/missing");
      return new Response(JSON.stringify({ error: { message: "Agent not found." } }), { status: 404 });
    }),
  });
  await assert.rejects(() => authed.agents.get("missing"), (error) => {
    assert.ok(error instanceof TalocodeError);
    assert.equal(error.status, 404);
    return true;
  });
});

test("CLI health prints JSON and a payment request refuses to imply a signature", async () => {
  const lines = [];
  const code = await run(["health"], {
    env: { TALOCODE_BASE_URL: "https://agent.example" },
    stdout: (line) => lines.push(line),
    stderr: () => {},
    fetchImpl: fakeFetch(() => new Response(JSON.stringify({ ok: true, signing: "owner-device-only" }), { status: 200 })),
  });
  assert.equal(code, 0);
  assert.match(lines.join(""), /owner-device-only/);

  const errors = [];
  const refused = await run(["payments", "request"], {
    env: { TALOCODE_BASE_URL: "https://agent.example", TALOCODE_API_KEY: "tk_example" },
    stdout: () => {},
    stderr: (line) => errors.push(line),
    fetchImpl: fakeFetch(() => {
      throw new Error("should not call");
    }),
  });
  assert.equal(refused, 1);
  assert.match(errors.join(""), /does not sign/);
});

function frame(message) {
  const json = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;
}

test("MCP lists request_payment and refuses to sign", async () => {
  const child = spawn(process.execPath, ["packages/agent-wallet/src/mcp.mjs"], {
    cwd: root,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const pending = new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    const found = [];
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("MCP server timed out"));
    }, 4000);
    child.stdout.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (true) {
        const headerEnd = buffer.indexOf("\r\n\r\n");
        if (headerEnd === -1) break;
        const header = buffer.subarray(0, headerEnd).toString("utf8");
        const match = /Content-Length:\s*(\d+)/i.exec(header);
        if (!match) break;
        const length = Number(match[1]);
        const start = headerEnd + 4;
        if (buffer.length < start + length) break;
        found.push(JSON.parse(buffer.subarray(start, start + length).toString("utf8")));
        buffer = buffer.subarray(start + length);
        if (found.length >= 3) {
          clearTimeout(timer);
          child.kill();
          resolve(found);
          return;
        }
      }
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
  child.stdin.write(frame({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }));
  child.stdin.write(frame({ jsonrpc: "2.0", id: 2, method: "tools/list" }));
  child.stdin.write(frame({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "sign_transaction", arguments: {} } }));
  const messages = await pending;
  const names = messages.find((message) => message.id === 2).result.tools.map((tool) => tool.name);
  assert.equal(messages.find((message) => message.id === 1).result.serverInfo.version, "0.2.0");
  assert.ok(names.includes("request_payment"));
  assert.ok(names.includes("api_health"));
  assert.equal(names.includes("sign_transaction"), false);
  assert.equal(messages.find((message) => message.id === 3).result.isError, true);
});
