#!/usr/bin/env node
/**
 * MCP server for Talocode Agent Wallet.
 * Stdio transport, Content-Length framing.
 * Requires TALOCODE_API_KEY and TALOCODE_BASE_URL.
 * Tools can request payments. They cannot sign them.
 */
const tools = [
  { name: "create_agent", description: "Create an agent for the authenticated developer.", inputSchema: { type: "object", properties: { name: { type: "string" }, description: { type: "string" } }, required: ["name"] } },
  { name: "list_agents", description: "List the developer's agents.", inputSchema: { type: "object", properties: {} } },
  { name: "get_agent", description: "Get one agent by id.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "list_wallets", description: "List wallet public metadata. Private keys are not returned.", inputSchema: { type: "object", properties: {} } },
  { name: "get_wallet_balance", description: "Read a live Solana Devnet SOL and USDC balance.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "get_spending_policy", description: "List spending policies. Limits are not a substitute for the owner signature.", inputSchema: { type: "object", properties: {} } },
  { name: "request_payment", description: "Ask for a Devnet payment. This does not sign or submit. The owner must approve on device.", inputSchema: { type: "object", properties: { agentId: { type: "string" }, walletId: { type: "string" }, recipient: { type: "string" }, amount: { type: "string" }, token: { type: "string" }, idempotencyKey: { type: "string" } }, required: ["agentId", "walletId", "recipient", "amount"] } },
  { name: "get_transaction", description: "Get one transaction. Confirmed means the Devnet cluster accepted it.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "list_transactions", description: "List recent transactions.", inputSchema: { type: "object", properties: { status: { type: "string" }, agentId: { type: "string" } } } },
];

function send(message) {
  const json = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`);
}

async function callApi(method, path, body) {
  const base = process.env.TALOCODE_BASE_URL;
  const key = process.env.TALOCODE_API_KEY;
  if (!base || !key) throw new Error("Set TALOCODE_BASE_URL and TALOCODE_API_KEY. Do not put a real key in the repository.");
  const response = await fetch(new URL(path, base), {
    method,
    headers: {
      authorization: `Bearer ${key}`,
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `API ${response.status}`);
  return payload;
}

async function callTool(name, args) {
  if (name === "sign_transaction" || name === "export_key" || name === "submit_signed") {
    throw new Error("This server cannot sign, export a key, or submit a signature.");
  }
  if (name === "create_agent") return callApi("POST", "/api/v1/agents", args);
  if (name === "list_agents") return callApi("GET", "/api/v1/agents");
  if (name === "get_agent") return callApi("GET", `/api/v1/agents/${encodeURIComponent(args.id)}`);
  if (name === "list_wallets") return callApi("GET", "/api/v1/wallets");
  if (name === "get_wallet_balance") return callApi("GET", `/api/v1/wallets/${encodeURIComponent(args.id)}/balance`);
  if (name === "get_spending_policy") return callApi("GET", "/api/v1/policies");
  if (name === "request_payment") return callApi("POST", "/api/v1/transactions", { token: "SOL", ...args });
  if (name === "get_transaction") return callApi("GET", `/api/v1/transactions/${encodeURIComponent(args.id)}`);
  if (name === "list_transactions") {
    const params = new URLSearchParams();
    if (args.status) params.set("status", args.status);
    if (args.agentId) params.set("agentId", args.agentId);
    return callApi("GET", `/api/v1/transactions${params.size ? `?${params}` : ""}`);
  }
  throw new Error("Unknown tool.");
}

async function onMessage(message) {
  if (!message || message.jsonrpc !== "2.0") return;
  if (message.method === "initialize") {
    send({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "talocode-agent-wallet", version: "0.1.0" } } });
    return;
  }
  if (message.method === "notifications/initialized") return;
  if (message.method === "tools/list") {
    send({ jsonrpc: "2.0", id: message.id, result: { tools } });
    return;
  }
  if (message.method === "tools/call") {
    try {
      const result = await callTool(message.params?.name, message.params?.arguments ?? {});
      send({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
    } catch (error) {
      send({ jsonrpc: "2.0", id: message.id, result: { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : "Tool failed." }] } });
    }
    return;
  }
  if (message.id !== undefined) {
    send({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found." } });
  }
}

let buffer = Buffer.alloc(0);
process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (buffer.length > 0) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) break;
    const header = buffer.slice(0, headerEnd).toString("utf8");
    const match = /Content-Length:\s*(\d+)/i.exec(header);
    if (!match) break;
    const length = Number(match[1]);
    const start = headerEnd + 4;
    if (buffer.length < start + length) break;
    const body = buffer.slice(start, start + length).toString("utf8");
    buffer = buffer.slice(start + length);
    try {
      void onMessage(JSON.parse(body));
    } catch (error) {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: error instanceof Error ? error.message : "Parse error." } });
    }
  }
});
