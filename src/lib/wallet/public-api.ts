export const AGENT_WALLET_VERSION = "0.2.0";

/** Liveness only. No key, no Devnet call, no signature. */
export function publicHealth() {
  return {
    ok: true,
    service: "talocode-agent-wallet",
    version: AGENT_WALLET_VERSION,
    network: "solana-devnet",
    signing: "owner-device-only",
    package: "@talocode/agent-wallet",
    cli: "talocode-wallet",
    note: "No API key. No Devnet call. No signature.",
  };
}

export function publicCapabilities() {
  return {
    service: "talocode-agent-wallet",
    version: AGENT_WALLET_VERSION,
    network: "solana-devnet",
    package: "@talocode/agent-wallet",
    surfaces: ["npm", "cli", "sdk", "mcp", "api"],
    public: ["GET /api/v1/health", "GET /api/v1/capabilities"],
    authenticated: [
      "GET /api/v1/agents",
      "POST /api/v1/agents",
      "GET /api/v1/agents/:id",
      "PATCH /api/v1/agents/:id",
      "DELETE /api/v1/agents/:id",
      "GET /api/v1/wallets",
      "POST /api/v1/wallets",
      "GET /api/v1/wallets/:id",
      "GET /api/v1/wallets/:id/balance",
      "POST /api/v1/wallets/assign",
      "GET /api/v1/transactions",
      "POST /api/v1/transactions",
      "GET /api/v1/transactions/:id",
      "POST /api/v1/transactions/:id/approve",
      "POST /api/v1/transactions/:id/reject",
      "POST /api/v1/transactions/:id/submit",
      "GET /api/v1/policies",
      "POST /api/v1/policies",
      "PATCH /api/v1/policies/:id",
      "GET /api/v1/usage",
      "GET /api/v1/network",
    ],
    cannot: ["sign a transaction", "export a private key", "send mainnet"],
    auth: "Authorization: Bearer tk_...",
  };
}
