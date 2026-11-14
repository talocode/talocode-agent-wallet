import { randomBytes, randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { comparableLamports, decidePolicy, decimalsFor, NETWORK, parseLamports, type TokenSymbol } from "./policy.ts";
import {
  addressUrl,
  assertAddress,
  broadcastSigned,
  buildTransfer,
  confirmSignature,
  explorerUrl,
  readBalances,
  requestDevnetSol,
  sha256,
  signatureStatus,
  signedTransferMatches,
} from "./solana.server.ts";

type Agent = { id: string; name: string; description: string; status: string; created_at: string };
type Wallet = { id: string; agent_id: string | null; public_key: string; network: string; created_at: string };
type Policy = {
  id: string;
  agent_id: string;
  max_tx_lamports: string;
  daily_lamports: string;
  monthly_lamports: string;
  approved_recipients: string;
  allowed_tokens: string;
  network: string;
  require_approval: boolean;
  expires_at: string | null;
};
type Tx = {
  id: string;
  agent_id: string;
  wallet_id: string;
  recipient: string;
  amount_lamports: string;
  token: string;
  network: string;
  status: string;
  signature: string | null;
  error: string | null;
  created_at: string;
};

function id(): string {
  return randomUUID();
}

function list(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

async function audit(userId: string, action: string, detail: string) {
  const sql = await getSql();
  await sql`insert into audit_logs (id, user_id, action, detail) values (${id()}, ${userId}, ${action}, ${detail.slice(0, 300)})`;
}

export async function listAgents(userId: string): Promise<Agent[]> {
  const sql = await getSql();
  return sql<Agent>`select id, name, description, status, created_at from agents where user_id = ${userId} order by created_at desc`;
}

export async function createAgent(userId: string, name: string, description: string): Promise<Agent> {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 80) throw new Error("Name the agent in 2 to 80 characters.");
  const sql = await getSql();
  const agentId = id();
  await sql`insert into agents (id, user_id, name, description) values (${agentId}, ${userId}, ${trimmed}, ${description.slice(0, 500)})`;
  await audit(userId, "agent.created", name);
  const rows = await sql<Agent>`select id, name, description, status, created_at from agents where id = ${agentId} and user_id = ${userId}`;
  return rows[0];
}

export async function updateAgent(userId: string, agentId: string, patch: { name?: string; description?: string; status?: string }) {
  const sql = await getSql();
  const rows = await sql<Agent>`select id, name, description, status, created_at from agents where id = ${agentId} and user_id = ${userId}`;
  const current = rows[0];
  if (!current) throw new Error("Agent not found.");
  const status = patch.status ?? current.status;
  if (!["active", "paused", "suspended"].includes(status)) throw new Error("Unknown status.");
  await sql`update agents set name = ${patch.name ?? current.name}, description = ${patch.description ?? current.description}, status = ${status} where id = ${agentId} and user_id = ${userId}`;
  await audit(userId, "agent.updated", agentId);
}

export async function deleteAgent(userId: string, agentId: string) {
  const sql = await getSql();
  await sql`delete from policies where agent_id = ${agentId} and user_id = ${userId}`;
  await sql`update wallets set agent_id = null where agent_id = ${agentId} and user_id = ${userId}`;
  await sql`delete from agents where id = ${agentId} and user_id = ${userId}`;
  await audit(userId, "agent.deleted", agentId);
}

export async function createWallet(userId: string, input: { agentId: string | null; publicKey: string; ciphertext: string; salt: string; iv: string }) {
  assertAddress(input.publicKey);
  if (input.ciphertext.length < 40 || input.ciphertext.length > 4000 || input.salt.length > 200 || input.iv.length > 200) {
    throw new Error("Encrypted key material is not the expected size.");
  }
  const sql = await getSql();
  const walletId = id();
  await sql`insert into wallets (id, user_id, agent_id, public_key, ciphertext, salt, iv, network) values (${walletId}, ${userId}, ${input.agentId}, ${input.publicKey}, ${input.ciphertext}, ${input.salt}, ${input.iv}, ${NETWORK})`;
  await audit(userId, "wallet.created", input.publicKey);
  return { id: walletId, publicKey: input.publicKey, network: NETWORK, explorer: addressUrl(input.publicKey) };
}

export async function getAgent(userId: string, agentId: string): Promise<Agent> {
  const sql = await getSql();
  const rows = await sql<Agent>`select id, name, description, status, created_at from agents where id = ${agentId} and user_id = ${userId}`;
  if (!rows[0]) throw new Error("Agent not found.");
  return rows[0];
}

export async function getWallet(userId: string, walletId: string) {
  const rows = await listWallets(userId);
  const wallet = rows.find((row) => row.id === walletId);
  if (!wallet) throw new Error("Wallet not found.");
  return wallet;
}

export async function assignWallet(userId: string, walletId: string, agentId: string | null) {
  const sql = await getSql();
  if (agentId) {
    const agents = await sql`select id from agents where id = ${agentId} and user_id = ${userId}`;
    if (!agents[0]) throw new Error("Agent not found.");
  }
  const rows = await sql`update wallets set agent_id = ${agentId} where id = ${walletId} and user_id = ${userId} returning id`;
  if (!rows[0]) throw new Error("Wallet not found.");
  await audit(userId, "wallet.assigned", walletId);
}

export async function getTransaction(userId: string, txId: string) {
  const rows = await listTransactions(userId, {});
  const tx = rows.find((row) => row.id === txId);
  if (!tx) throw new Error("Transaction not found.");
  return tx;
}

export async function usage(userId: string) {
  const sql = await getSql();
  const tx = await sql<{ status: string; n: string }>`select status, count(*)::text as n from transactions where user_id = ${userId} group by status`;
  const keys = await sql<{ n: string }>`select count(*)::text as n from api_keys where user_id = ${userId} and revoked_at is null`;
  const calls = await sql<{ n: string }>`select count(*)::text as n from audit_logs where user_id = ${userId} and action = 'api_key.created'`;
  return {
    transactionsByStatus: tx,
    activeKeys: Number(keys[0]?.n ?? 0),
    keysCreated: Number(calls[0]?.n ?? 0),
    rateLimit: "60 requests per minute per API key, counted in this server process.",
  };
}

export async function listAudit(userId: string) {
  const sql = await getSql();
  return sql<{ id: string; action: string; detail: string; created_at: string }>`select id, action, detail, created_at from audit_logs where user_id = ${userId} order by created_at desc limit 30`;
}

export async function updatePolicyById(userId: string, policyId: string, input: {
  maxTx: string;
  daily: string;
  monthly: string;
  recipients: string;
  tokens: string;
  requireApproval: boolean;
  expiresAt: string | null;
}) {
  const sql = await getSql();
  const rows = await sql<{ agent_id: string }>`select agent_id from policies where id = ${policyId} and user_id = ${userId}`;
  if (!rows[0]) throw new Error("Policy not found.");
  return savePolicy(userId, { ...input, agentId: rows[0].agent_id });
}

export async function listWallets(userId: string): Promise<Array<Wallet & { explorer: string }>> {
  const sql = await getSql();
  const rows = await sql<Wallet>`select id, agent_id, public_key, network, created_at from wallets where user_id = ${userId} order by created_at desc`;
  return rows.map((row) => ({ ...row, explorer: addressUrl(row.public_key) }));
}

export async function walletBalance(userId: string, walletId: string) {
  const sql = await getSql();
  const rows = await sql<Wallet>`select id, agent_id, public_key, network, created_at from wallets where id = ${walletId} and user_id = ${userId}`;
  const wallet = rows[0];
  if (!wallet) throw new Error("Wallet not found.");
  const balances = await readBalances(wallet.public_key);
  return { ...wallet, ...balances, network: NETWORK, note: "Devnet balances are test tokens. They have no monetary value.", explorer: addressUrl(wallet.public_key) };
}

export async function airdrop(userId: string, walletId: string) {
  const sql = await getSql();
  const rows = await sql<Wallet>`select id, agent_id, public_key, network, created_at from wallets where id = ${walletId} and user_id = ${userId}`;
  const wallet = rows[0];
  if (!wallet) throw new Error("Wallet not found.");
  const signature = await requestDevnetSol(wallet.public_key);
  const txId = id();
  await sql`insert into transactions (id, user_id, agent_id, wallet_id, recipient, amount_lamports, token, network, status, signature) values (${txId}, ${userId}, ${"inbound"}, ${wallet.id}, ${wallet.public_key}, ${"1000000000"}, ${"SOL"}, ${NETWORK}, ${"submitted"}, ${signature})`;
  const checked = await signatureStatus(signature);
  await sql`update transactions set status = ${checked}, updated_at = now() where id = ${txId} and user_id = ${userId}`;
  return { id: txId, signature, status: checked, explorer: explorerUrl(signature) };
}

export async function savePolicy(userId: string, input: {
  agentId: string;
  maxTx: string;
  daily: string;
  monthly: string;
  recipients: string;
  tokens: string;
  requireApproval: boolean;
  expiresAt: string | null;
}) {
  const sql = await getSql();
  const agents = await sql`select id from agents where id = ${input.agentId} and user_id = ${userId}`;
  if (!agents[0]) throw new Error("Agent not found.");
  const maxTx = parseLamports(input.maxTx, 9);
  const daily = parseLamports(input.daily, 9);
  const monthly = parseLamports(input.monthly, 9);
  if (daily < maxTx || monthly < daily) throw new Error("Monthly limit must cover the daily limit, and the daily limit must cover one transaction.");
  list(input.recipients).forEach((address) => assertAddress(address));
  const tokens = list(input.tokens);
  if (tokens.some((token) => token !== "SOL" && token !== "USDC")) throw new Error("Approved tokens are SOL and Devnet USDC only.");
  const existing = await sql<{ id: string }>`select id from policies where agent_id = ${input.agentId} and user_id = ${userId}`;
  const policyId = existing[0]?.id ?? id();
  if (existing[0]) {
    await sql`update policies set max_tx_lamports = ${maxTx.toString()}, daily_lamports = ${daily.toString()}, monthly_lamports = ${monthly.toString()}, approved_recipients = ${input.recipients}, allowed_tokens = ${tokens.join(",")}, require_approval = ${input.requireApproval}, expires_at = ${input.expiresAt}, network = ${NETWORK} where id = ${policyId} and user_id = ${userId}`;
  } else {
    await sql`insert into policies (id, user_id, agent_id, max_tx_lamports, daily_lamports, monthly_lamports, approved_recipients, allowed_tokens, require_approval, expires_at, network) values (${policyId}, ${userId}, ${input.agentId}, ${maxTx.toString()}, ${daily.toString()}, ${monthly.toString()}, ${input.recipients}, ${tokens.join(",")}, ${input.requireApproval}, ${input.expiresAt}, ${NETWORK})`;
  }
  await audit(userId, "policy.saved", input.agentId);
  return { id: policyId };
}

export async function listPolicies(userId: string): Promise<Policy[]> {
  const sql = await getSql();
  return sql<Policy>`select id, agent_id, max_tx_lamports, daily_lamports, monthly_lamports, approved_recipients, allowed_tokens, network, require_approval, expires_at from policies where user_id = ${userId} order by created_at desc`;
}

async function spent(userId: string, agentId: string, sinceIso: string): Promise<bigint> {
  const sql = await getSql();
  const rows = await sql<{ amount_lamports: string; token: string }>`select amount_lamports, token from transactions where user_id = ${userId} and agent_id = ${agentId} and status in ('awaiting_approval', 'submitted', 'confirmed') and created_at >= ${sinceIso}::timestamptz`;
  return rows.reduce((sum, row) => {
    const amount = BigInt(String(row.amount_lamports).split(".")[0] || "0");
    if (row.token !== "SOL" && row.token !== "USDC") return sum;
    return sum + comparableLamports(row.token, amount);
  }, 0n);
}

export async function createTransaction(userId: string, input: {
  agentId: string;
  walletId: string;
  recipient: string;
  amount: string;
  token: TokenSymbol;
  idempotencyKey: string | null;
}) {
  const sql = await getSql();
  assertAddress(input.recipient);
  const amount = parseLamports(input.amount, decimalsFor(input.token));
  const idempotencyKey = input.idempotencyKey?.trim() || null;
  if (idempotencyKey) {
    const prior = await sql<Tx>`select id, agent_id, wallet_id, recipient, amount_lamports, token, network, status, signature, error, created_at from transactions where user_id = ${userId} and idempotency_key = ${idempotencyKey}`;
    if (prior[0]) {
      const same = prior[0].agent_id === input.agentId
        && prior[0].wallet_id === input.walletId
        && prior[0].recipient === input.recipient
        && prior[0].token === input.token
        && String(prior[0].amount_lamports) === amount.toString();
      if (!same) throw new Error("This idempotency key was already used for a different payment.");
      return { transaction: prior[0], replayed: true };
    }
  }
  const agents = await sql<Agent>`select id, name, description, status, created_at from agents where id = ${input.agentId} and user_id = ${userId}`;
  const wallets = await sql<Wallet>`select id, agent_id, public_key, network, created_at from wallets where id = ${input.walletId} and user_id = ${userId}`;
  const policies = await sql<Policy>`select id, agent_id, max_tx_lamports, daily_lamports, monthly_lamports, approved_recipients, allowed_tokens, network, require_approval, expires_at from policies where agent_id = ${input.agentId} and user_id = ${userId}`;
  const agent = agents[0];
  const wallet = wallets[0];
  const policy = policies[0];
  if (!agent || !wallet || !policy) throw new Error("The agent, wallet, and spending policy all have to exist first.");
  assertAddress(input.recipient);
  const now = new Date();
  const startDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const comparable = comparableLamports(input.token, amount);
  const decision = decidePolicy({
    maxTxLamports: BigInt(policy.max_tx_lamports),
    dailyLamports: BigInt(policy.daily_lamports),
    monthlyLamports: BigInt(policy.monthly_lamports),
    approvedRecipients: list(policy.approved_recipients),
    allowedTokens: list(policy.allowed_tokens),
    network: policy.network,
    requireApproval: policy.require_approval,
    expiresAt: policy.expires_at,
    agentStatus: agent.status,
  }, {
    token: input.token,
    network: NETWORK,
    amountLamports: comparable,
    recipient: input.recipient,
    spentToday: await spent(userId, agent.id, startDay),
    spentMonth: await spent(userId, agent.id, startMonth),
    now,
  });
  if (!decision.ok) throw new Error(decision.reason);
  const txId = id();
  await sql`insert into transactions (id, user_id, agent_id, wallet_id, recipient, amount_lamports, token, network, status, idempotency_key) values (${txId}, ${userId}, ${agent.id}, ${wallet.id}, ${input.recipient}, ${amount.toString()}, ${input.token}, ${NETWORK}, ${"awaiting_approval"}, ${idempotencyKey})`;
  await audit(userId, "transaction.requested", txId);
  return { transaction: { id: txId, status: "awaiting_approval", reason: decision.reason }, replayed: false };
}

export async function listTransactions(userId: string, filter: { agentId?: string; token?: string; status?: string; from?: string; to?: string }) {
  const sql = await getSql();
  const rows = await sql<Tx>`select id, agent_id, wallet_id, recipient, amount_lamports, token, network, status, signature, error, created_at from transactions where user_id = ${userId} order by created_at desc limit 200`;
  return rows.filter((row) => {
    const created = new Date(row.created_at).getTime();
    const fromOk = !filter.from || created >= new Date(filter.from).getTime();
    const toOk = !filter.to || created <= new Date(filter.to).getTime() + 86_400_000;
    return (!filter.agentId || row.agent_id === filter.agentId)
      && (!filter.token || row.token === filter.token)
      && (!filter.status || row.status === filter.status)
      && fromOk
      && toOk;
  }).map((row) => ({ ...row, explorer: row.signature ? explorerUrl(row.signature) : null }));
}

export async function rejectTransaction(userId: string, txId: string) {
  const sql = await getSql();
  const rows = await sql`update transactions set status = 'rejected', updated_at = now() where id = ${txId} and user_id = ${userId} and status = 'awaiting_approval' returning id`;
  if (!rows[0]) throw new Error("That payment is not waiting for approval.");
  await audit(userId, "transaction.rejected", txId);
}

export async function reviewTransaction(userId: string, txId: string) {
  const prepared = await prepareTransaction(userId, txId);
  await audit(userId, "transaction.reviewed", txId);
  return {
    approved: false as const,
    needsOwnerSignature: true as const,
    message: "The API cannot sign. Sign this on the device that knows the passphrase, then submit the signed transaction.",
    ...prepared,
  };
}

export async function prepareTransaction(userId: string, txId: string) {
  const sql = await getSql();
  const rows = await sql<Tx & { public_key: string }>`select t.id, t.agent_id, t.wallet_id, t.recipient, t.amount_lamports, t.token, t.network, t.status, t.signature, t.error, t.created_at, w.public_key from transactions t join wallets w on w.id = t.wallet_id where t.id = ${txId} and t.user_id = ${userId} and w.user_id = ${userId}`;
  const tx = rows[0];
  if (!tx || tx.status !== "awaiting_approval") throw new Error("That payment is not waiting for a signature.");
  const built = await buildTransfer({
    from: tx.public_key,
    to: tx.recipient,
    amountLamports: BigInt(tx.amount_lamports),
    token: tx.token === "USDC" ? "USDC" : "SOL",
  });
  let simulation: string | null = null;
  try {
    const { Transaction } = await import("@solana/web3.js");
    const unsigned = Transaction.from(Buffer.from(built.unsigned, "base64"));
    const result = await (await import("./solana.server.ts")).connection.simulateTransaction(unsigned);
    simulation = result.value.err ? `Simulation failed: ${JSON.stringify(result.value.err)}` : "Simulation succeeded.";
  } catch (error) {
    simulation = error instanceof Error ? error.message : "Simulation did not run.";
  }
  return { unsigned: built.unsigned, feeLamports: built.feeLamports, simulation, walletId: tx.wallet_id };
}

export async function walletCipher(userId: string, walletId: string) {
  const sql = await getSql();
  const rows = await sql<{ ciphertext: string; salt: string; iv: string }>`select ciphertext, salt, iv from wallets where id = ${walletId} and user_id = ${userId}`;
  const row = rows[0];
  if (!row) throw new Error("Wallet not found.");
  return row;
}

export async function submitTransaction(userId: string, txId: string, signed: string) {
  const sql = await getSql();
  const rows = await sql<Tx & { public_key: string }>`select t.id, t.agent_id, t.wallet_id, t.recipient, t.amount_lamports, t.token, t.network, t.status, t.signature, t.error, t.created_at, w.public_key from transactions t join wallets w on w.id = t.wallet_id where t.id = ${txId} and t.user_id = ${userId} and w.user_id = ${userId}`;
  const tx = rows[0];
  if (!tx) throw new Error("That payment cannot be submitted.");
  if (tx.signature) return { signature: tx.signature, status: tx.status, explorer: explorerUrl(tx.signature) };
  if (tx.status !== "awaiting_approval") throw new Error("That payment cannot be submitted.");
  const raw = signedTransferMatches(signed, {
    from: tx.public_key,
    to: tx.recipient,
    amountLamports: BigInt(tx.amount_lamports),
    token: tx.token === "USDC" ? "USDC" : "SOL",
  });
  const claimed = await sql`update transactions set status = 'submitted', updated_at = now() where id = ${txId} and user_id = ${userId} and status = 'awaiting_approval' and signature is null returning id`;
  if (!claimed[0]) {
    const again = await sql<Tx>`select status, signature from transactions where id = ${txId} and user_id = ${userId}`;
    if (again[0]?.signature) return { signature: again[0].signature, status: again[0].status, explorer: explorerUrl(again[0].signature) };
    throw new Error("That payment is already being submitted.");
  }
  let signature: string;
  try {
    signature = await broadcastSigned(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The network rejected the transaction.";
    await sql`update transactions set status = 'failed', error = ${message}, updated_at = now() where id = ${txId} and user_id = ${userId} and signature is null`;
    throw new Error(message);
  }
  await sql`update transactions set signature = ${signature}, status = 'submitted', error = null, updated_at = now() where id = ${txId} and user_id = ${userId}`;
  const result = await confirmSignature(signature);
  const chain = await signatureStatus(signature);
  const status = result.confirmed || chain === "confirmed" ? "confirmed" : chain === "failed" ? "failed" : "submitted";
  const errorText = status === "confirmed" ? null : result.error;
  await sql`update transactions set status = ${status}, signature = ${signature}, error = ${errorText}, updated_at = now() where id = ${txId} and user_id = ${userId}`;
  await audit(userId, "transaction.submitted", signature);
  return { signature, status, explorer: explorerUrl(signature) };
}

export async function refreshTransaction(userId: string, txId: string) {
  const sql = await getSql();
  const rows = await sql<Tx>`select id, agent_id, wallet_id, recipient, amount_lamports, token, network, status, signature, error, created_at from transactions where id = ${txId} and user_id = ${userId}`;
  const tx = rows[0];
  if (!tx?.signature) return tx;
  const status = await signatureStatus(tx.signature);
  await sql`update transactions set status = ${status}, updated_at = now() where id = ${txId} and user_id = ${userId}`;
  return { ...tx, status, explorer: explorerUrl(tx.signature) };
}

export async function overview(userId: string) {
  const sql = await getSql();
  const agents = await sql<{ status: string }>`select status from agents where user_id = ${userId}`;
  const wallets = await sql<{ id: string }>`select id from wallets where user_id = ${userId}`;
  const policies = await sql<{ id: string }>`select id from policies where user_id = ${userId}`;
  const pendingRows = await sql<{ n: string }>`select count(*)::text as n from transactions where user_id = ${userId} and status = 'awaiting_approval'`;
  const confirmed = await sql<{ token: string; amount_lamports: string }>`select token, amount_lamports from transactions where user_id = ${userId} and status = 'confirmed'`;
  let sol = 0n;
  let usdc = 0n;
  for (const row of confirmed) {
    const amount = BigInt(String(row.amount_lamports).split(".")[0] || "0");
    if (row.token === "USDC") usdc += amount;
    if (row.token === "SOL" && row.amount_lamports) sol += amount;
  }
  const txs = await sql<Tx>`select id, agent_id, wallet_id, recipient, amount_lamports, token, network, status, signature, error, created_at from transactions where user_id = ${userId} order by created_at desc limit 8`;
  return {
    agents: agents.length,
    activeAgents: agents.filter((agent) => agent.status === "active").length,
    wallets: wallets.length,
    policies: policies.length,
    pending: Number(pendingRows[0]?.n ?? 0),
    confirmedSolLamports: sol.toString(),
    confirmedUsdcBase: usdc.toString(),
    network: NETWORK,
    recent: txs.map((tx) => ({ ...tx, explorer: tx.signature ? explorerUrl(tx.signature) : null })),
  };
}

const buckets = new Map<string, { count: number; reset: number }>();
const MAX_BUCKETS = 4000;

function chargeRateLimit(digest: string) {
  const now = Date.now();
  if (buckets.size > MAX_BUCKETS) {
    for (const [key, bucket] of buckets) {
      if (now > bucket.reset) buckets.delete(key);
    }
    while (buckets.size > MAX_BUCKETS) {
      const oldest = buckets.keys().next().value;
      if (!oldest) break;
      buckets.delete(oldest);
    }
  }
  const bucket = buckets.get(digest) ?? { count: 0, reset: now + 60_000 };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + 60_000;
  }
  bucket.count += 1;
  buckets.set(digest, bucket);
  if (bucket.count > 60) throw new Error("Rate limit exceeded. Wait a minute.");
}

export async function createApiKey(userId: string, name: string, permissions: string) {
  const allowed = permissions.split(",").map((item) => item.trim()).filter((item) => item === "read" || item === "transact");
  if (allowed.length === 0) throw new Error("Choose read, transact, or both.");
  const secret = `tk_${randomBytes(24).toString("base64url")}`;
  const sql = await getSql();
  await sql`insert into api_keys (id, user_id, name, key_hash, prefix, permissions) values (${id()}, ${userId}, ${name}, ${sha256(secret)}, ${secret.slice(0, 10)}, ${allowed.join(",")})`;
  await audit(userId, "api_key.created", name);
  return { secret, prefix: secret.slice(0, 10), permissions: allowed.join(",") };
}

export async function listApiKeys(userId: string) {
  const sql = await getSql();
  return sql<{ id: string; name: string; prefix: string; permissions: string; last_used_at: string | null; revoked_at: string | null; created_at: string }>`select id, name, prefix, permissions, last_used_at, revoked_at, created_at from api_keys where user_id = ${userId} order by created_at desc`;
}

export async function revokeApiKey(userId: string, keyId: string) {
  const sql = await getSql();
  await sql`update api_keys set revoked_at = now() where id = ${keyId} and user_id = ${userId}`;
  await audit(userId, "api_key.revoked", keyId);
}

export async function userFromApiKey(token: string, permission: "read" | "transact"): Promise<string> {
  const digest = sha256(token);
  chargeRateLimit(digest);
  const sql = await getSql();
  const rows = await sql<{ user_id: string; permissions: string; revoked_at: string | null; id: string }>`select id, user_id, permissions, revoked_at from api_keys where key_hash = ${digest}`;
  const key = rows[0];
  if (!key || key.revoked_at) throw new Error("API key rejected.");
  if (!key.permissions.split(",").includes(permission) && !(permission === "read" && key.permissions.includes("transact"))) {
    throw new Error("This API key does not have that permission.");
  }
  await sql`update api_keys set last_used_at = now() where id = ${key.id}`;
  return key.user_id;
}
