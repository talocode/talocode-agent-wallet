export class TalocodeError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "TalocodeError";
    this.status = status;
  }
}

export type TalocodeOptions = {
  apiKey: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
};

type Json = Record<string, unknown>;

export class Talocode {
  options: TalocodeOptions;
  constructor(options: TalocodeOptions) {
    if (!options.apiKey?.trim()) throw new Error("apiKey is required.");
    if (!options.baseUrl?.trim()) throw new Error("baseUrl is required.");
    this.options = options;
  }

  private async request<T>(method: string, path: string, body?: Json, headers?: Record<string, string>): Promise<T> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const response = await fetchImpl(new URL(path, this.options.baseUrl), {
      method,
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = (await response.json()) as { error?: { message?: string } };
    if (!response.ok) throw new TalocodeError(payload.error?.message || `Request failed (${response.status}).`, response.status);
    return payload as T;
  }

  agents = {
    list: () => this.request<{ agents: Json[] }>("GET", "/api/v1/agents"),
    get: (id: string) => this.request<{ agent: Json }>("GET", `/api/v1/agents/${encodeURIComponent(id)}`),
    create: (input: { name: string; description?: string }) => this.request<{ agent: Json }>("POST", "/api/v1/agents", input),
    update: (id: string, input: { name?: string; description?: string; status?: "active" | "paused" | "suspended" }) =>
      this.request<{ agent: Json }>("PATCH", `/api/v1/agents/${encodeURIComponent(id)}`, input),
    delete: (id: string) => this.request<{ ok: boolean }>("DELETE", `/api/v1/agents/${encodeURIComponent(id)}`),
  };

  wallets = {
    list: () => this.request<{ wallets: Json[] }>("GET", "/api/v1/wallets"),
    get: (id: string) => this.request<{ wallet: Json }>("GET", `/api/v1/wallets/${encodeURIComponent(id)}`),
    register: (input: { publicKey: string; ciphertext: string; salt: string; iv: string; agentId?: string }) =>
      this.request<{ wallet: Json }>("POST", "/api/v1/wallets", input),
    getBalance: (id: string) => this.request<{ sol: string; usdc: string; public_key: string; note: string }>("GET", `/api/v1/wallets/${encodeURIComponent(id)}/balance`),
  };

  transactions = {
    list: (query: { agentId?: string; token?: string; status?: string; from?: string; to?: string } = {}) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
      const suffix = params.size ? `?${params.toString()}` : "";
      return this.request<{ transactions: Json[] }>("GET", `/api/v1/transactions${suffix}`);
    },
    get: (id: string) => this.request<{ transaction: Json }>("GET", `/api/v1/transactions/${encodeURIComponent(id)}`),
    create: (input: { agentId: string; walletId: string; recipient: string; amount: string; token?: "SOL" | "USDC"; idempotencyKey?: string }) =>
      this.request<{ transaction: Json; replayed: boolean }>("POST", "/api/v1/transactions", input, input.idempotencyKey ? { "idempotency-key": input.idempotencyKey } : undefined),
    review: (id: string) => this.request<Json>("POST", `/api/v1/transactions/${encodeURIComponent(id)}/approve`),
    reject: (id: string) => this.request<Json>("POST", `/api/v1/transactions/${encodeURIComponent(id)}/reject`),
    submit: (id: string, signed: string) => this.request<Json>("POST", `/api/v1/transactions/${encodeURIComponent(id)}/submit`, { signed }),
  };

  policies = {
    list: () => this.request<{ policies: Json[] }>("GET", "/api/v1/policies"),
    save: (input: { agentId: string; maxTx: string; daily: string; monthly: string; recipients?: string; tokens?: string; requireApproval?: boolean; expiresAt?: string | null }) =>
      this.request<Json>("POST", "/api/v1/policies", input),
    update: (id: string, input: { maxTx: string; daily: string; monthly: string; recipients?: string; tokens?: string; requireApproval?: boolean; expiresAt?: string | null }) =>
      this.request<Json>("PATCH", `/api/v1/policies/${encodeURIComponent(id)}`, input),
  };

  usage = () => this.request<Json>("GET", "/api/v1/usage");
  network = () => this.request<Json>("GET", "/api/v1/network");
}
