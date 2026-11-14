import { createFileRoute } from "@tanstack/react-router";
import { clusterStatus } from "@/lib/wallet/solana.server";
import {
  assignWallet,
  createAgent,
  createTransaction,
  createWallet,
  deleteAgent,
  getAgent,
  getTransaction,
  getWallet,
  listAgents,
  listPolicies,
  listTransactions,
  listWallets,
  rejectTransaction,
  reviewTransaction,
  savePolicy,
  submitTransaction,
  updateAgent,
  updatePolicyById,
  usage,
  userFromApiKey,
  walletBalance,
} from "@/lib/wallet/store.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type, idempotency-key",
      "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    },
  });
}

function str(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (request.method === "GET" || request.method === "DELETE") return {};
  const text = await request.text();
  if (!text) return {};
  if (text.length > 20_000) throw new Error("Request body is too large.");
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON object required.");
  return parsed as Record<string, unknown>;
}

async function dispatch(userId: string, method: string, route: string[], body: Record<string, unknown>, url: URL, idempotencyKey: string | null) {
  const [a, b, c] = route;
  if (a === "agents" && !b && method === "GET") return json({ agents: await listAgents(userId) });
  if (a === "agents" && !b && method === "POST") {
    return json({ agent: await createAgent(userId, str(body, "name"), str(body, "description")) }, 201);
  }
  if (a === "agents" && b && !c && method === "GET") return json({ agent: await getAgent(userId, b) });
  if (a === "agents" && b && !c && method === "PATCH") {
    await updateAgent(userId, b, {
      name: body.name === undefined ? undefined : str(body, "name"),
      description: body.description === undefined ? undefined : str(body, "description"),
      status: body.status === undefined ? undefined : str(body, "status"),
    });
    return json({ agent: await getAgent(userId, b) });
  }
  if (a === "agents" && b && !c && method === "DELETE") {
    await deleteAgent(userId, b);
    return json({ ok: true });
  }
  if (a === "wallets" && !b && method === "GET") return json({ wallets: await listWallets(userId) });
  if (a === "wallets" && !b && method === "POST") {
    const wallet = await createWallet(userId, {
      agentId: str(body, "agentId") || null,
      publicKey: str(body, "publicKey"),
      ciphertext: str(body, "ciphertext"),
      salt: str(body, "salt"),
      iv: str(body, "iv"),
    });
    return json({ wallet }, 201);
  }
  if (a === "wallets" && b && !c && method === "GET") return json({ wallet: await getWallet(userId, b) });
  if (a === "wallets" && b === "assign" && method === "POST") {
    await assignWallet(userId, str(body, "walletId"), str(body, "agentId") || null);
    return json({ ok: true });
  }
  if (a === "wallets" && b && c === "balance" && method === "GET") return json(await walletBalance(userId, b));
  if (a === "transactions" && !b && method === "GET") {
    return json({
      transactions: await listTransactions(userId, {
        agentId: url.searchParams.get("agentId") ?? undefined,
        token: url.searchParams.get("token") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
        from: url.searchParams.get("from") ?? undefined,
        to: url.searchParams.get("to") ?? undefined,
      }),
    });
  }
  if (a === "transactions" && !b && method === "POST") {
    const token = str(body, "token") || "SOL";
    if (token !== "SOL" && token !== "USDC") throw new Error("Token must be SOL or USDC.");
    const created = await createTransaction(userId, {
      agentId: str(body, "agentId"),
      walletId: str(body, "walletId"),
      recipient: str(body, "recipient"),
      amount: str(body, "amount"),
      token,
      idempotencyKey: idempotencyKey || str(body, "idempotencyKey") || null,
    });
    return json(created, created.replayed ? 200 : 201);
  }
  if (a === "transactions" && b && c === "approve" && method === "POST") return json(await reviewTransaction(userId, b));
  if (a === "transactions" && b && c === "reject" && method === "POST") {
    await rejectTransaction(userId, b);
    return json({ transaction: await getTransaction(userId, b) });
  }
  if (a === "transactions" && b && c === "submit" && method === "POST") {
    return json(await submitTransaction(userId, b, str(body, "signed")));
  }
  if (a === "transactions" && b && !c && method === "GET") return json({ transaction: await getTransaction(userId, b) });
  if (a === "policies" && !b && method === "GET") return json({ policies: await listPolicies(userId) });
  if (a === "policies" && !b && method === "POST") {
    const saved = await savePolicy(userId, {
      agentId: str(body, "agentId"),
      maxTx: str(body, "maxTx"),
      daily: str(body, "daily"),
      monthly: str(body, "monthly"),
      recipients: str(body, "recipients"),
      tokens: str(body, "tokens") || "SOL",
      requireApproval: body.requireApproval !== false,
      expiresAt: str(body, "expiresAt") || null,
    });
    return json(saved, 201);
  }
  if (a === "policies" && b && !c && method === "PATCH") {
    return json(await updatePolicyById(userId, b, {
      maxTx: str(body, "maxTx"),
      daily: str(body, "daily"),
      monthly: str(body, "monthly"),
      recipients: str(body, "recipients"),
      tokens: str(body, "tokens") || "SOL",
      requireApproval: body.requireApproval !== false,
      expiresAt: str(body, "expiresAt") || null,
    }));
  }
  if (a === "usage" && !b && method === "GET") return json(await usage(userId));
  if (a === "network" && !b && method === "GET") return json(await clusterStatus());
  return json({ error: { message: "No such endpoint." } }, 404);
}

async function handle(request: Request) {
  if (request.method === "OPTIONS") return json({ ok: true });
  const declared = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > 20_000) {
    return json({ error: { message: "Request body is too large." } }, 400);
  }
  const url = new URL(request.url);
  const route = url.pathname.split("/").filter(Boolean).slice(2);
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return json({ error: { message: "Send Authorization: Bearer tk_..." } }, 401);
  try {
    const userId = await userFromApiKey(token, request.method === "GET" ? "read" : "transact");
    const body = await readBody(request);
    return await dispatch(userId, request.method, route, body, url, request.headers.get("idempotency-key"));
  } catch (error) {
    const message = error instanceof SyntaxError ? "JSON object required." : error instanceof Error ? error.message : "Request failed.";
    const status = message.includes("Rate limit") ? 429
      : message.includes("API key") ? 401
      : message.includes("permission") ? 403
      : message.includes("not found") || message.includes("not waiting") ? 404
      : message.includes("No such") ? 404
      : 400;
    return json({ error: { message } }, status);
  }
}

export const Route = createFileRoute("/api/v1/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
      PATCH: ({ request }) => handle(request),
      DELETE: ({ request }) => handle(request),
      OPTIONS: ({ request }) => handle(request),
    },
  },
});
