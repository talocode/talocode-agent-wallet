import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { clusterStatus } from "./solana.server";
import {
  airdrop,
  assignWallet,
  createAgent,
  createApiKey,
  createTransaction,
  createWallet,
  deleteAgent,
  listAgents,
  listApiKeys,
  listAudit,
  listPolicies,
  listTransactions,
  listWallets,
  overview,
  prepareTransaction,
  refreshTransaction,
  rejectTransaction,
  reviewTransaction,
  revokeApiKey,
  savePolicy,
  submitTransaction,
  updateAgent,
  usage,
  walletBalance,
  walletCipher,
} from "./store.server";

function text(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

export const overviewFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => overview(context.userId));

export const clusterFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => clusterStatus());

export const agentsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => listAgents(context.userId));

export const createAgentFn = createServerFn({ method: "POST" })
  .validator((input: { name: string; description: string }) => {
    const name = text(input?.name, 80);
    if (name.length < 2) throw new Error("Name the agent in 2 to 80 characters.");
    return { name, description: text(input?.description, 500) };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => createAgent(context.userId, data.name, data.description));

export const updateAgentFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; name?: string; description?: string; status?: string }) => ({
    id: text(input?.id, 80),
    name: input?.name === undefined ? undefined : text(input.name, 80),
    description: input?.description === undefined ? undefined : text(input.description, 500),
    status: input?.status === undefined ? undefined : text(input.status, 20),
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    if (!data.id) throw new Error("Missing agent.");
    await updateAgent(context.userId, data.id, data);
    return { ok: true };
  });

export const deleteAgentFn = createServerFn({ method: "POST" })
  .validator((id: string) => text(id, 80))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    await deleteAgent(context.userId, data);
    return { ok: true };
  });

export const walletsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => listWallets(context.userId));

export const createWalletFn = createServerFn({ method: "POST" })
  .validator((input: { agentId: string | null; publicKey: string; ciphertext: string; salt: string; iv: string }) => ({
    agentId: input?.agentId ? text(input.agentId, 80) : null,
    publicKey: text(input?.publicKey, 64),
    ciphertext: text(input?.ciphertext, 4000),
    salt: text(input?.salt, 200),
    iv: text(input?.iv, 200),
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => createWallet(context.userId, data));

export const assignWalletFn = createServerFn({ method: "POST" })
  .validator((input: { walletId: string; agentId: string | null }) => ({
    walletId: text(input?.walletId, 80),
    agentId: input?.agentId ? text(input.agentId, 80) : null,
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    await assignWallet(context.userId, data.walletId, data.agentId);
    return { ok: true };
  });

export const balanceFn = createServerFn({ method: "POST" })
  .validator((id: string) => text(id, 80))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => walletBalance(context.userId, data));

export const airdropFn = createServerFn({ method: "POST" })
  .validator((id: string) => text(id, 80))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => airdrop(context.userId, data));

export const policiesFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => listPolicies(context.userId));

export const savePolicyFn = createServerFn({ method: "POST" })
  .validator((input: {
    agentId: string;
    maxTx: string;
    daily: string;
    monthly: string;
    recipients: string;
    tokens: string;
    requireApproval: boolean;
    expiresAt: string | null;
  }) => ({
    agentId: text(input?.agentId, 80),
    maxTx: text(input?.maxTx, 40),
    daily: text(input?.daily, 40),
    monthly: text(input?.monthly, 40),
    recipients: text(input?.recipients, 2000),
    tokens: text(input?.tokens, 40),
    requireApproval: Boolean(input?.requireApproval),
    expiresAt: input?.expiresAt ? text(input.expiresAt, 40) : null,
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => savePolicy(context.userId, data));

export const transactionsFn = createServerFn({ method: "POST" })
  .validator((input: { agentId?: string; token?: string; status?: string; from?: string; to?: string }) => ({
    agentId: text(input?.agentId, 80),
    token: text(input?.token, 10),
    status: text(input?.status, 30),
    from: text(input?.from, 40),
    to: text(input?.to, 40),
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => listTransactions(context.userId, {
    agentId: data.agentId || undefined,
    token: data.token || undefined,
    status: data.status || undefined,
    from: data.from || undefined,
    to: data.to || undefined,
  }));

export const createTransactionFn = createServerFn({ method: "POST" })
  .validator((input: { agentId: string; walletId: string; recipient: string; amount: string; token: string; idempotencyKey?: string }) => {
    const token = text(input?.token, 10) || "SOL";
    if (token !== "SOL" && token !== "USDC") throw new Error("Token must be SOL or USDC.");
    return {
      agentId: text(input?.agentId, 80),
      walletId: text(input?.walletId, 80),
      recipient: text(input?.recipient, 64),
      amount: text(input?.amount, 40),
      token: token as "SOL" | "USDC",
      idempotencyKey: text(input?.idempotencyKey, 80) || null,
    };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => createTransaction(context.userId, data));

export const rejectFn = createServerFn({ method: "POST" })
  .validator((id: string) => text(id, 80))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    await rejectTransaction(context.userId, data);
    return { ok: true };
  });

export const prepareFn = createServerFn({ method: "POST" })
  .validator((id: string) => text(id, 80))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => prepareTransaction(context.userId, data));

export const cipherFn = createServerFn({ method: "POST" })
  .validator((id: string) => text(id, 80))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => walletCipher(context.userId, data));

export const submitFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; signed: string }) => ({
    id: text(input?.id, 80),
    signed: text(input?.signed, 12000),
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => submitTransaction(context.userId, data.id, data.signed));

export const refreshFn = createServerFn({ method: "POST" })
  .validator((id: string) => text(id, 80))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => refreshTransaction(context.userId, data));

export const keysFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => listApiKeys(context.userId));

export const createKeyFn = createServerFn({ method: "POST" })
  .validator((input: { name: string; permissions: string }) => ({
    name: text(input?.name, 80),
    permissions: text(input?.permissions, 40),
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    if (data.name.length < 2) throw new Error("Name the key.");
    return createApiKey(context.userId, data.name, data.permissions);
  });

export const revokeKeyFn = createServerFn({ method: "POST" })
  .validator((id: string) => text(id, 80))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    await revokeApiKey(context.userId, data);
    return { ok: true };
  });

export const auditFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => listAudit(context.userId));

export const usageFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => usage(context.userId));

export const reviewFn = createServerFn({ method: "POST" })
  .validator((id: string) => text(id, 80))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => reviewTransaction(context.userId, data));
