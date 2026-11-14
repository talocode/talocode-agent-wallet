import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { agentsFn, policiesFn, savePolicyFn } from "@/lib/wallet/fns";
import { formatLamports } from "@/lib/wallet/policy";
import { Button, Field, messageOf, Notice, Panel, TextInput } from "@/components/ui";

export const Route = createFileRoute("/app/policies")({ component: PoliciesPage });

function PoliciesPage() {
  const [agents, setAgents] = useState<Awaited<ReturnType<typeof agentsFn>>>([]);
  const [policies, setPolicies] = useState<Awaited<ReturnType<typeof policiesFn>>>([]);
  const [agentId, setAgentId] = useState("");
  const [maxTx, setMaxTx] = useState("0.05");
  const [daily, setDaily] = useState("0.2");
  const [monthly, setMonthly] = useState("1");
  const [recipients, setRecipients] = useState("");
  const [tokens, setTokens] = useState("SOL");
  const [requireApproval, setRequireApproval] = useState(true);
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");

  function load() {
    agentsFn().then((rows) => {
      setAgents(rows);
      setAgentId((current) => current || rows[0]?.id || "");
    }).catch((cause) => setError(messageOf(cause)));
    policiesFn().then(setPolicies).catch((cause) => setError(messageOf(cause)));
  }
  useEffect(load, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await savePolicyFn({ data: { agentId, maxTx, daily, monthly, recipients, tokens, requireApproval, expiresAt: expiresAt || null } });
      load();
    } catch (cause) {
      setError(messageOf(cause));
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-4xl">Spending policies</h1>
        <p className="mt-1 text-sm text-muted">Limits are checked on the server before a signature is offered. They are denominated in SOL. 1 Devnet USDC counts as 1 SOL against the cap. An empty recipient list allows any address. That is not a lock. Even an in-policy payment must be signed on your device.</p>
      </div>
      <Panel title="Policy">
        <form className="grid gap-3" onSubmit={(event) => void save(event)}>
          <Field label="Agent">
            <select className="h-11 rounded-md border border-border bg-bg px-3" value={agentId} onChange={(event) => setAgentId(event.target.value)}>
              {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Max transaction, SOL"><TextInput value={maxTx} onChange={(event) => setMaxTx(event.target.value)} /></Field>
            <Field label="Daily, SOL"><TextInput value={daily} onChange={(event) => setDaily(event.target.value)} /></Field>
            <Field label="Monthly, SOL"><TextInput value={monthly} onChange={(event) => setMonthly(event.target.value)} /></Field>
          </div>
          <Field label="Approved recipients, comma separated"><TextInput value={recipients} onChange={(event) => setRecipients(event.target.value)} placeholder="Leave empty to allow any Devnet address" /></Field>
          <Field label="Tokens"><TextInput value={tokens} onChange={(event) => setTokens(event.target.value)} placeholder="SOL or SOL,USDC" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={requireApproval} onChange={(event) => setRequireApproval(event.target.checked)} /> Show this as requiring a human review. Unchecking it does not let the server sign.</label>
          <Field label="Expires"><TextInput type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></Field>
          <Button type="submit">Save policy</Button>
        </form>
      </Panel>
      {error && <Notice tone="bad">{error}</Notice>}
      {policies.length === 0 && <p className="text-sm text-muted">No policy yet. Payments are refused until one exists.</p>}
      {policies.map((policy) => (
        <article key={policy.id} className="rounded-lg border border-border p-4 text-sm text-muted">
          <p>Agent {policy.agent_id}</p>
          <p>Max {formatLamports(BigInt(policy.max_tx_lamports), 9)} SOL · daily {formatLamports(BigInt(policy.daily_lamports), 9)} · monthly {formatLamports(BigInt(policy.monthly_lamports), 9)}</p>
          <p>Tokens {policy.allowed_tokens || "none"} · recipients {policy.approved_recipients || "any Devnet address"} · network {policy.network}</p>
        </article>
      ))}
    </div>
  );
}
