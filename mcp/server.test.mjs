import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

function frame(message) {
  const json = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;
}

function readFrames(child) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    const messages = [];
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
        messages.push(JSON.parse(buffer.subarray(start, start + length).toString("utf8")));
        buffer = buffer.subarray(start + length);
        if (messages.length >= 3) {
          clearTimeout(timer);
          child.kill();
          resolve(messages);
          return;
        }
      }
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

test("MCP lists payment tools and refuses to sign", async () => {
  const child = spawn(process.execPath, ["mcp/server.mjs"], {
    cwd: dirname(dirname(fileURLToPath(import.meta.url))),
    stdio: ["pipe", "pipe", "pipe"],
  });
  const pending = readFrames(child);
  child.stdin.write(frame({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }));
  child.stdin.write(frame({ jsonrpc: "2.0", id: 2, method: "tools/list" }));
  child.stdin.write(frame({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "sign_transaction", arguments: {} } }));
  const messages = await pending;
  const init = messages.find((message) => message.id === 1);
  const list = messages.find((message) => message.id === 2);
  const sign = messages.find((message) => message.id === 3);
  assert.equal(init.result.serverInfo.name, "talocode-agent-wallet");
  const names = list.result.tools.map((tool) => tool.name);
  assert.ok(names.includes("request_payment"));
  assert.equal(names.includes("sign_transaction"), false);
  assert.equal(sign.result.isError, true);
  assert.match(sign.result.content[0].text, /cannot sign/i);
});
