import { createFileRoute, Link } from "@tanstack/react-router";
import { USDC_DEVNET_MINT } from "@/lib/wallet/policy";

export const Route = createFileRoute("/docs")({ component: Docs });

const sections = [
  ["intro", "Introduction", "Talocode Agent Wallet lets a developer give an AI agent a Solana Devnet wallet, a spending policy, and a payment request flow. The owner signs. The server does not."],
  ["what", "What it is", "It is infrastructure, not a custodial wallet and not a token. Agents can ask for a payment through the dashboard, the REST API, or MCP. Nothing is submitted until the passphrase is entered on the owner's device."],
  ["quick", "Quickstart", "Create an account. Create an agent. Generate a wallet and keep the passphrase. Save a policy, for example 0.05 SOL per payment and 0.2 SOL per day. Request 0.01 SOL to a Devnet address. Open Approvals, preview the simulation, and sign. The history row links to Solana Explorer only after a signature exists."],
  ["install", "Installation", "The dashboard is this web app. The TypeScript client lives in src/sdk/client.ts and is imported as a local module, not a published npm package yet. The MCP server is mcp/server.mjs."],
  ["authn", "Authentication", "People sign in with Google, X, or email and password. Programs send Authorization: Bearer tk_... Keys are hashed with SHA-256. The full secret is shown once. read can list. transact can request, reject, and submit an already signed transaction. Neither permission can create a signature."],
  ["agent", "Creating an agent", "POST /api/v1/agents with { name, description }. Status is active, paused, or suspended. A paused agent cannot pass the policy check."],
  ["wallet", "Creating a wallet", "Generate the keypair in the browser. Encrypt the 64-byte secret with AES-GCM and PBKDF2-SHA256, 210000 iterations. POST only publicKey, ciphertext, salt, and iv. There is no server endpoint that returns a private key."],
  ["balance", "Balances", "GET /api/v1/wallets/:id/balance reads live Devnet SOL and the Circle Devnet USDC account. A missing token account is a zero balance, not a fake one."],
  ["policy", "Spending policies", "Set a max payment, a daily cap, and a monthly cap in SOL units. Optional recipient allow-list. Tokens are SOL and USDC. 1 USDC counts as 1 SOL against the cap. Empty recipients means any address. The policy is enforced in the API before a transaction row is created. It is not a Solana program. An exported key can ignore it."],
  ["pay", "Requesting payments", "POST /api/v1/transactions with agentId, walletId, recipient, amount, and token. Send Idempotency-Key to make a retry return the same row. A different payload with the same key is rejected. The status is awaiting_approval. It is not submitted."],
  ["approve", "Approving", "The Approvals screen decrypts the key locally and signs. POST /api/v1/transactions/:id/approve only returns the unsigned transaction and says the API cannot sign. Reject sets status rejected and does not contact the cluster."],
  ["watch", "Monitoring", "Statuses are awaiting_approval, rejected, submitted, confirmed, and failed. Confirmed means the Devnet cluster reported the signature confirmed or finalized. Refresh a submitted row from the history table. Do not treat a request as paid."],
  ["rest", "REST reference", "Base path /api/v1. Agents, wallets, wallets/:id/balance, transactions, transactions/:id/approve, reject, and submit, policies, usage, and network. Errors are { error: { message } }. 60 requests a minute per key, in that server process."],
  ["sdk", "TypeScript SDK", "new Talocode({ apiKey: process.env.TALOCODE_API_KEY, baseUrl }). Then agents.create, wallets.getBalance, transactions.create. See src/sdk/README.md. Examples use placeholders, never a real key."],
  ["mcp", "MCP", "Run node mcp/server.mjs with TALOCODE_BASE_URL and TALOCODE_API_KEY. Tools: create_agent, list_agents, get_agent, list_wallets, get_wallet_balance, get_spending_policy, request_payment, get_transaction, list_transactions. request_payment cannot sign."],
  ["security", "Security architecture", "Session auth is Better Auth. API auth is a hashed bearer key. Private keys are encrypted in the browser. Logs store public ids and actions. The server rebuilds the expected transfer and rejects a signed payload that does not match the recipient, amount, token, or fee payer. Known gaps are listed in Settings and in docs/SECURITY.md."],
  ["devnet", "Devnet setup", `RPC is https://api.devnet.solana.com. USDC mint is ${USDC_DEVNET_MINT}. requestAirdrop on that RPC currently returns HTTP 410. Use https://faucet.solana.com with the wallet public key. If that fails, the error is shown and no success is invented. Devnet tokens have no monetary value.`],
  ["trouble", "Troubleshooting", "Pop-up blocked: allow pop-ups for Google or X. The public Devnet RPC faucet is closed, so the airdrop button can return HTTP 410. Copy the wallet address, open https://faucet.solana.com, choose Devnet, sign in with GitHub, and request SOL to that address. Refresh the balance. You need more than the payment plus the fee, about 5000 lamports. Simulation failed with InvalidAccountForFee means the wallet is still empty. Forgot passphrase: create another wallet. Mainnet addresses are rejected. An explorer link appears only after Devnet returns a signature. Confirmed is a separate status and is not inferred."],
];

function Docs() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-2"><img src={`${import.meta.env.BASE_URL}brand/talocode-logo.png`} alt="" className="h-8 w-8" /><span className="text-sm">Docs</span></Link>
        <Link to="/app" className="text-sm text-primary">Dashboard</Link>
      </header>
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-6">
        <h1 className="font-serif text-5xl">Developer documentation</h1>
        <nav className="flex flex-wrap gap-2 text-sm">
          {sections.map(([id, title]) => <a key={id} href={`#${id}`} className="text-muted">{title}</a>)}
        </nav>
        {sections.map(([id, title, body]) => (
          <section key={id} id={id} className="space-y-2">
            <h2 className="font-serif text-3xl">{title}</h2>
            <p className="text-muted">{body}</p>
          </section>
        ))}
        <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-4 text-sm text-fg">{`const talocode = new Talocode({
  apiKey: process.env.TALOCODE_API_KEY,
  baseUrl: process.env.TALOCODE_BASE_URL,
});

const payment = await talocode.transactions.create({
  agentId, walletId, recipient, amount: "0.01", token: "SOL",
});`}</pre>
      </main>
    </div>
  );
}
