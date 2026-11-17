export const PACKAGE_NAME = "@talocode/agent-wallet";
export const PACKAGE_VERSION = "0.2.0";

export class TalocodeError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "TalocodeError";
    this.status = status;
  }
}

export function joinUrl(baseUrl, path) {
  const root = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(String(path).replace(/^\//, ""), root);
}

export class TalocodeAgentWallet {
  constructor(options = {}) {
    this.baseUrl = String(options.baseUrl ?? "").trim();
    this.apiKey = String(options.apiKey ?? "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    if (!this.baseUrl) throw new Error("baseUrl is required.");
  }

  async request(method, path, body, headers, auth = true) {
    if (auth && !this.apiKey.trim()) throw new Error("apiKey is required.");
    const response = await this.fetchImpl(joinUrl(this.baseUrl, path), {
      method,
      headers: {
        accept: "application/json",
        ...(auth ? { authorization: `Bearer ${this.apiKey}` } : {}),
        ...(body ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new TalocodeError(payload?.error?.message || `Request failed (${response.status}).`, response.status);
    }
    return payload;
  }

  health() {
    return this.request("GET", "/api/v1/health", undefined, undefined, false);
  }

  capabilities() {
    return this.request("GET", "/api/v1/capabilities", undefined, undefined, false);
  }

  agents = {
    list: () => this.request("GET", "/api/v1/agents"),
    get: (id) => this.request("GET", `/api/v1/agents/${encodeURIComponent(id)}`),
    create: (input) => this.request("POST", "/api/v1/agents", input),
    update: (id, input) => this.request("PATCH", `/api/v1/agents/${encodeURIComponent(id)}`, input),
    delete: (id) => this.request("DELETE", `/api/v1/agents/${encodeURIComponent(id)}`),
  };

  wallets = {
    list: () => this.request("GET", "/api/v1/wallets"),
    get: (id) => this.request("GET", `/api/v1/wallets/${encodeURIComponent(id)}`),
    register: (input) => this.request("POST", "/api/v1/wallets", input),
    getBalance: (id) => this.request("GET", `/api/v1/wallets/${encodeURIComponent(id)}/balance`),
  };

  transactions = {
    list: (query = {}) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
      const suffix = params.size ? `?${params.toString()}` : "";
      return this.request("GET", `/api/v1/transactions${suffix}`);
    },
    get: (id) => this.request("GET", `/api/v1/transactions/${encodeURIComponent(id)}`),
    create: (input) =>
      this.request(
        "POST",
        "/api/v1/transactions",
        input,
        input.idempotencyKey ? { "idempotency-key": input.idempotencyKey } : undefined,
      ),
    review: (id) => this.request("POST", `/api/v1/transactions/${encodeURIComponent(id)}/approve`),
    reject: (id) => this.request("POST", `/api/v1/transactions/${encodeURIComponent(id)}/reject`),
    submit: (id, signed) => this.request("POST", `/api/v1/transactions/${encodeURIComponent(id)}/submit`, { signed }),
  };

  policies = {
    list: () => this.request("GET", "/api/v1/policies"),
    save: (input) => this.request("POST", "/api/v1/policies", input),
    update: (id, input) => this.request("PATCH", `/api/v1/policies/${encodeURIComponent(id)}`, input),
  };

  usage() {
    return this.request("GET", "/api/v1/usage");
  }

  network() {
    return this.request("GET", "/api/v1/network");
  }
}
