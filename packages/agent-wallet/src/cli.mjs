import { TalocodeAgentWallet } from "./client.mjs";
import { startMcp } from "./mcp.mjs";

export const HELP = `talocode-wallet — Talocode Agent Wallet
Solana Devnet. This program can request a payment. It cannot sign or export a key.

Usage:
  talocode-wallet health
  talocode-wallet capabilities
  talocode-wallet agents list
  talocode-wallet agents create --name <name> [--description <text>]
  talocode-wallet agents get <id>
  talocode-wallet agents update <id> [--name <name>] [--description <text>] [--status active|paused|suspended]
  talocode-wallet wallets list
  talocode-wallet wallets balance <id>
  talocode-wallet policies list
  talocode-wallet payments list [--status <status>] [--agent <id>]
  talocode-wallet payments get <id>
  talocode-wallet payments request --agent <id> --wallet <id> --recipient <address> --amount <amount> [--token SOL|USDC] [--idempotency-key <key>]
  talocode-wallet usage
  talocode-wallet network
  talocode-wallet mcp

Environment:
  TALOCODE_BASE_URL   API origin. Include a base path if the app is not at /.
  TALOCODE_API_KEY    Bearer key. Not required for health or capabilities.

A payment request stays awaiting_approval until the owner signs on device.
`;

function flags(args) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = args[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = "true";
      else {
        out[key] = next;
        i += 1;
      }
    } else out._.push(token);
  }
  return out;
}

function clientFrom(env, fetchImpl, auth = true) {
  const baseUrl = env.TALOCODE_BASE_URL ?? "";
  const apiKey = env.TALOCODE_API_KEY ?? "";
  if (!String(baseUrl).trim()) throw new Error("Set TALOCODE_BASE_URL.");
  if (auth && !String(apiKey).trim()) throw new Error("Set TALOCODE_API_KEY.");
  return new TalocodeAgentWallet({ baseUrl, apiKey, fetchImpl });
}

export async function run(argv, io = {}) {
  const stdout = io.stdout ?? ((line) => process.stdout.write(line));
  const stderr = io.stderr ?? ((line) => process.stderr.write(line));
  const env = io.env ?? process.env;
  const fetchImpl = io.fetchImpl ?? fetch;
  const [command, sub, ...rest] = argv;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    stdout(HELP);
    return 0;
  }

  try {
    if (command === "mcp") {
      if (!String(env.TALOCODE_BASE_URL ?? "").trim()) throw new Error("Set TALOCODE_BASE_URL.");
      startMcp({ env, fetchImpl });
      return 0;
    }
    if (command === "health") {
      stdout(`${JSON.stringify(await clientFrom(env, fetchImpl, false).health(), null, 2)}\n`);
      return 0;
    }
    if (command === "capabilities") {
      stdout(`${JSON.stringify(await clientFrom(env, fetchImpl, false).capabilities(), null, 2)}\n`);
      return 0;
    }

    const client = clientFrom(env, fetchImpl, true);
    const parsed = flags(rest);
    let payload;

    if (command === "agents" && sub === "list") payload = await client.agents.list();
    else if (command === "agents" && sub === "get") payload = await client.agents.get(parsed._[0] ?? "");
    else if (command === "agents" && sub === "create") {
      if (!parsed.name) throw new Error("agents create needs --name.");
      payload = await client.agents.create({ name: parsed.name, description: parsed.description });
    } else if (command === "agents" && sub === "update") {
      if (!parsed._[0]) throw new Error("agents update needs an id.");
      payload = await client.agents.update(parsed._[0], {
        ...(parsed.name ? { name: parsed.name } : {}),
        ...(parsed.description ? { description: parsed.description } : {}),
        ...(parsed.status ? { status: parsed.status } : {}),
      });
    } else if (command === "wallets" && sub === "list") payload = await client.wallets.list();
    else if (command === "wallets" && sub === "balance") payload = await client.wallets.getBalance(parsed._[0] ?? "");
    else if (command === "policies" && sub === "list") payload = await client.policies.list();
    else if (command === "payments" && sub === "list") {
      payload = await client.transactions.list({ status: parsed.status, agentId: parsed.agent });
    } else if (command === "payments" && sub === "get") payload = await client.transactions.get(parsed._[0] ?? "");
    else if (command === "payments" && sub === "request") {
      if (!parsed.agent || !parsed.wallet || !parsed.recipient || !parsed.amount) {
        throw new Error("payments request needs --agent, --wallet, --recipient, and --amount. It does not sign.");
      }
      payload = await client.transactions.create({
        agentId: parsed.agent,
        walletId: parsed.wallet,
        recipient: parsed.recipient,
        amount: parsed.amount,
        token: parsed.token === "USDC" ? "USDC" : "SOL",
        idempotencyKey: parsed["idempotency-key"],
      });
    } else if (command === "usage") payload = await client.usage();
    else if (command === "network") payload = await client.network();
    else throw new Error(`Unknown command. Run talocode-wallet --help.`);

    stdout(`${JSON.stringify(payload, null, 2)}\n`);
    return 0;
  } catch (error) {
    stderr(`${error instanceof Error ? error.message : "Command failed."}\n`);
    return 1;
  }
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  run(process.argv.slice(2)).then((code) => {
    if (code !== 0) process.exitCode = code;
  });
}
