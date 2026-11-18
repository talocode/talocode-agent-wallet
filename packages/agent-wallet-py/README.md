# talocode-agent-wallet

Python SDK, CLI, and MCP server for [Talocode Agent Wallet](https://github.com/talocode/talocode-agent-wallet).

Solana Devnet only. A payment request stays unsigned until the owner signs on their device. This package cannot sign, export a key, or send mainnet.

The JavaScript package is [`@talocode/agent-wallet`](https://www.npmjs.com/package/@talocode/agent-wallet). This is the Python package. It is not the existing [`talocode`](https://pypi.org/project/talocode/) Cloud client.

```bash
pip install talocode-agent-wallet
```

```bash
export TALOCODE_BASE_URL="https://your-agent-wallet-host"
talocode-wallet health
```

```python
from talocode_agent_wallet import TalocodeAgentWallet

client = TalocodeAgentWallet("https://your-agent-wallet-host", api_key="")
print(client.health())
```

`health()` and `capabilities()` do not send a key. Listing agents, reading a balance, and requesting a payment need `TALOCODE_API_KEY`.

```python
client = TalocodeAgentWallet("https://your-agent-wallet-host", api_key="tk_...")
payment = client.request_payment("agent_id", "wallet_id", "RECIPIENT", "0.01")
```

That call does not sign.

MCP:

```bash
talocode-wallet mcp
```

Tools include `request_payment`. There is no sign tool. `sign_transaction` returns an error.
