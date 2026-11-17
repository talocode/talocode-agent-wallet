# @talocode/agent-wallet

TypeScript client for Talocode Agent Wallet. The copy you import inside this app is `src/sdk/client.ts`. The publishable package is `packages/agent-wallet`. Both call the REST API. Neither signs transactions or sees a passphrase.

```ts
import { Talocode } from "./client";

const talocode = new Talocode({
  apiKey: process.env.TALOCODE_API_KEY ?? "",
  baseUrl: process.env.TALOCODE_BASE_URL ?? "https://your-deployed-app.example",
});

const health = await talocode.health();
const { agent } = await talocode.agents.create({
  name: "Research Agent",
  description: "Reads papers and pays for sources on Devnet.",
});

const { wallets } = await talocode.wallets.list();
const balance = await talocode.wallets.getBalance(wallets[0].id as string);

const payment = await talocode.transactions.create({
  agentId: agent.id as string,
  walletId: wallets[0].id as string,
  recipient: "RECIPIENT_DEVNET_ADDRESS",
  amount: "0.01",
  token: "SOL",
  idempotencyKey: "research-source-001",
});
```

`transactions.create` only requests a payment. The owner signs it in the dashboard. `transactions.review` returns an unsigned transaction and does not submit it. `transactions.submit` accepts a signed transaction that must match the approved recipient, token, and amount.

Generate the keypair in the browser with `createEncryptedKeypair` from `src/lib/wallet/client-sign.ts`, then `wallets.register` the public key and ciphertext. Do not send a plaintext secret.

Devnet SOL and Devnet USDC have no monetary value. Mainnet is not connected.
