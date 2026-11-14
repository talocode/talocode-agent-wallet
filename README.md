# Talocode Agent Wallet

Financial infrastructure for AI agents. Solana Devnet only. Agents can request a payment. The owner sets the limits and signs on device. The server never holds a usable private key.

Spending limits are application rules. They are not enforced on-chain.

## What you can do

1. Register with Google, X, or email and password.
2. Create an agent.
3. Generate a wallet in the browser. The passphrase stays on that page.
4. Save a spending policy. Example: 0.05 SOL per payment, 0.2 SOL per day, 1 SOL per month.
5. Request a payment. Out-of-policy requests are rejected before a signature is offered.
6. Open Approvals, preview the simulation, and sign. A confirmed row links to Solana Explorer.
7. Read history in the dashboard or `GET /api/v1/transactions`.

## Fund a Devnet wallet

`requestAirdrop` on `https://api.devnet.solana.com` returns HTTP 410. The public RPC faucet is closed.

1. Copy the wallet public key from Wallets.
2. Open [https://faucet.solana.com](https://faucet.solana.com).
3. Select Devnet.
4. Sign in with GitHub if the page asks. The site says AI agents should not use that faucet, so a person should request the funds.
5. Paste the public key and request test SOL.
6. Refresh the balance in this app. It must cover the payment plus the fee.
7. Approve the payment. Do not treat a failed simulation as a success.

Devnet USDC mint, test tokens only: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`.

## REST

```bash
curl -H "Authorization: Bearer $TALOCODE_API_KEY" "$TALOCODE_BASE_URL/api/v1/agents"
```

Create a key in API keys. It is shown once. `read` can list. `transact` can request a payment. Neither can sign.

## SDK

See [src/sdk/README.md](src/sdk/README.md).

```ts
import { Talocode } from "./src/sdk/client.ts";

const client = new Talocode({
  apiKey: process.env.TALOCODE_API_KEY ?? "",
  baseUrl: process.env.TALOCODE_BASE_URL ?? "http://127.0.0.1:8080",
});
const agents = await client.agents.list();
```

## MCP

See [mcp/README.md](mcp/README.md). The server can request a payment. It cannot sign, export a key, or submit a signature.

## Environment

Copy [env.example](env.example). Do not commit a filled `.env`. The hosted preview injects `DATABASE_URL` and auth credentials. Leave them unset locally to use embedded Postgres and the preview sign-in client.

## Tests

```bash
npm run typecheck
npm run build
npm test
```

## Deployment

The preview build uses Nitro's Vercel preset. A Netlify build (`NETLIFY=true`, which Netlify sets itself) uses `@netlify/vite-plugin-tanstack-start` and publishes `dist/client`. See [netlify.toml](netlify.toml) and [docs/SETUP.md](docs/SETUP.md).

`agent-wallet.talocode.site` needs a DNS CNAME to the Netlify hostname. That record is not in this repo. Auth and payment history on Netlify need `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL`. Without Postgres, a serverless instance cannot keep accounts.

## License

Recommendation: MIT, so other builders can use the client and MCP server. That has not been adopted in a LICENSE file yet. Confirm it before adding one.
