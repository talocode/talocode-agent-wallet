# Talocode Agent Wallet MCP

This server exposes the same REST API to an MCP client. A tool can request a payment. It cannot sign, and it cannot read a private key.

## Setup

1. Create an API key in the dashboard. It is shown once.
2. Point the client at this file.

```json
{
  "mcpServers": {
    "talocode-agent-wallet": {
      "command": "node",
      "args": ["mcp/server.mjs"],
      "env": {
        "TALOCODE_BASE_URL": "https://your-deployed-app.example",
        "TALOCODE_API_KEY": "tk_replace_me"
      }
    }
  }
}
```

Use a read key for lookup tools. Requesting a payment needs the transact permission. The payment stays `awaiting_approval` until the owner signs it in the dashboard.

Works with any MCP client that speaks stdio and Content-Length framing, including Claude Desktop style configs. The tool names are `create_agent`, `list_agents`, `get_agent`, `list_wallets`, `get_wallet_balance`, `get_spending_policy`, `request_payment`, `get_transaction`, and `list_transactions`.
