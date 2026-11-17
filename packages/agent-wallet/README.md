# @talocode/agent-wallet

SDK, CLI, and MCP server for Talocode Agent Wallet.

Solana Devnet only. The client can request a payment. It cannot sign, and it never sees a passphrase. The owner signs in the dashboard.

This package is MIT. It is not a claim that the name is already on the public npm registry. Pack it from this folder, or publish it when the Talocode npm account is the one running `npm publish`.

## Install from this repo

```bash
cd packages/agent-wallet
npm pack
npm install -g ./talocode-agent-wallet-0.2.0.tgz
```

## CLI

```bash
export TALOCODE_BASE_URL="https://your-deployed-app.example"
export TALOCODE_API_KEY="tk_replace_me"

talocode-wallet health
talocode-wallet agents list
talocode-wallet payments request \
  --agent AGENT_ID \
  --wallet WALLET_ID \
  --recipient RECIPIENT_DEVNET_ADDRESS \
  --amount 0.01
```

`health` and `capabilities` do not need a key. `payments request` creates `awaiting_approval`. It does not submit.

## SDK

```js
import { TalocodeAgentWallet } from "@talocode/agent-wallet";

const talocode = new TalocodeAgentWallet({
  apiKey: process.env.TALOCODE_API_KEY,
  baseUrl: process.env.TALOCODE_BASE_URL,
});

const health = await talocode.health();
const { agent } = await talocode.agents.create({ name: "Research Agent" });
const payment = await talocode.transactions.create({
  agentId: agent.id,
  walletId: "WALLET_ID",
  recipient: "RECIPIENT_DEVNET_ADDRESS",
  amount: "0.01",
  token: "SOL",
});
```

`baseUrl` may include a path, for example `https://talocode.site/agent-wallet`. The client appends `api/v1/...` under that path.

## MCP

```bash
talocode-wallet mcp
```

Or point a client at `packages/agent-wallet/src/mcp.mjs` with `TALOCODE_BASE_URL` and `TALOCODE_API_KEY`.

Tools: `api_health`, `api_capabilities`, `create_agent`, `list_agents`, `get_agent`, `list_wallets`, `get_wallet_balance`, `get_spending_policy`, `request_payment`, `get_transaction`, `list_transactions`.

There is no sign tool.

## Hosted API

Public:

- `GET /api/v1/health`
- `GET /api/v1/capabilities`

Everything else needs `Authorization: Bearer tk_...`. `read` can list. `transact` can request a payment. Neither can sign.

Devnet SOL and Devnet USDC have no monetary value. Mainnet is not connected.
