import { TalocodeAgentWallet } from "./client.mjs";

const tools = [
  { name: "api_health", description: "Public liveness check. No API key, no Devnet call, no signature.", inputSchema: { type: "object", properties: {} } },
  { name: "api_capabilities", description: "List the hosted Agent Wallet routes. Public.", inputSchema: { type: "object", properties: {} } },
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

function clientFor(env, fetchImpl, auth) {
  const baseUrl = env.TALOCODE_BASE_URL ?? "";
  const apiKey = env.TALOCODE_API_KEY ?? "";
  if (!String(baseUrl).trim()) throw new Error("Set TALOCODE_BASE_URL. Do not put a real key in the repository.");
  if (auth && !String(apiKey).trim()) throw new Error("Set TALOCODE_API_KEY. Do not put a real key in the repository.");
  return new TalocodeAgentWallet({ baseUrl, apiKey, fetchImpl });
}

async function callTool(name, args, env, fetchImpl) {
  if (name === "sign_transaction" || name === "export_key" || name === "submit_signed") {
    throw new Error("This server cannot sign, export a key, or submit a signature.");
  }
  if (name === "api_health") return clientFor(env, fetchImpl, false).health();
  if (name === "api_capabilities") return clientFor(env, fetchImpl, false).capabilities();
  const client = clientFor(env, fetchImpl, true);
  if (name === "create_agent") return client.agents.create(args);
  if (name === "list_agents") return client.agents.list();
  if (name === "get_agent") return client.agents.get(args.id);
  if (name === "list_wallets") return client.wallets.list();
  if (name === "get_wallet_balance") return client.wallets.getBalance(args.id);
  if (name === "get_spending_policy") return client.policies.list();
  if (name === "request_payment") {
    return client.transactions.create({
      token: "SOL",
      ...args,
    });
  }
  if (name === "get_transaction") return client.transactions.get(args.id);
  if (name === "list_transactions") return client.transactions.list({ status: args.status, agentId: args.agentId });
  throw new Error("Unknown tool.");
}

export function startMcp({ env = process.env, fetchImpl = fetch } = {}) {
  async function onMessage(message) {
    if (!message || message.jsonrpc !== "2.0") return;
    if (message.method === "initialize") {
      send({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "talocode-agent-wallet", version: "0.2.0" },
        },
      });
      return;
    }
    if (message.method === "notifications/initialized") return;
    if (message.method === "tools/list") {
      send({ jsonrpc: "2.0", id: message.id, result: { tools } });
      return;
    }
    if (message.method === "tools/call") {
      try {
        const result = await callTool(message.params?.name, message.params?.arguments ?? {}, env, fetchImpl);
        send({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
      } catch (error) {
        send({
          jsonrpc: "2.0",
          id: message.id,
          result: { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : "Tool failed." }] },
        });
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
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/"));
if (invokedDirectly) startMcp();
