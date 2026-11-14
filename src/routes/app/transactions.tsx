import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { agentsFn, createTransactionFn, refreshFn, transactionsFn, walletsFn } from "@/lib/wallet/fns";
import { money } from "@/lib/wallet/policy";
import { Button, Field, messageOf, Notice, Panel, TextInput } from "@/components/ui";

export const Route = createFileRoute("/app/transactions")({ component: TransactionsPage });

function TransactionsPage() {
  const [agents, setAgents] = useState<Awaited<ReturnType<typeof agentsFn>>>([]);
  const [wallets, setWallets] = useState<Awaited<ReturnType<typeof walletsFn>>>([]);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof transactionsFn>> | null>(null);
  const [agentId, setAgentId] = useState("");
  const [walletId, setWalletId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("0.01");
  const [token, setToken] = useState("SOL");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [status, setStatus] = useState("");
  const [filterToken, setFilterToken] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  function load(next?: { agentId?: string; token?: string; status?: string; from?: string; to?: string }) {
    const data = next ?? { agentId, token: filterToken, status, from, to };
    transactionsFn({ data }).then(setRows).catch((cause) => setError(messageOf(cause)));
  }
  useEffect(() => {
    agentsFn().then((items) => { setAgents(items); setAgentId(items[0]?.id ?? ""); }).catch((cause) => setError(messageOf(cause)));
    walletsFn().then((items) => { setWallets(items); setWalletId(items[0]?.id ?? ""); }).catch((cause) => setError(messageOf(cause)));
    load({});
  }, []);

  async function requestPayment(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNote("");
    try {
      const created = await createTransactionFn({ data: { agentId, walletId, recipient, amount, token, idempotencyKey } });
      setNote(created.replayed ? "Returned the existing payment for that idempotency key." : ("reason" in created.transaction ? created.transaction.reason : "Waiting for your signature."));
      load({});
    } catch (cause) {
      setError(messageOf(cause));
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="font-serif text-4xl">Transactions</h1>
      <Panel title="Request a payment">
        <form className="grid gap-3" onSubmit={(event) => void requestPayment(event)}>
          <Field label="Agent">
            <select className="h-11 rounded-md border border-border bg-bg px-3" value={agentId} onChange={(event) => setAgentId(event.target.value)}>
              {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
            </select>
          </Field>
          <Field label="Wallet">
            <select className="h-11 rounded-md border border-border bg-bg px-3" value={walletId} onChange={(event) => setWalletId(event.target.value)}>
              {wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.public_key.slice(0, 8)}…</option>)}
            </select>
          </Field>
          <Field label="Recipient"><TextInput value={recipient} onChange={(event) => setRecipient(event.target.value)} required /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount"><TextInput value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
            <Field label="Token">
              <select className="h-11 w-full rounded-md border border-border bg-bg px-3" value={token} onChange={(event) => setToken(event.target.value)}>
                <option>SOL</option>
                <option>USDC</option>
              </select>
            </Field>
          </div>
          <Field label="Idempotency key, optional"><TextInput value={idempotencyKey} onChange={(event) => setIdempotencyKey(event.target.value)} /></Field>
          <Button type="submit">Request payment</Button>
        </form>
      </Panel>
      {note && <Notice>{note}</Notice>}
      {error && <Notice tone="bad">{error}</Notice>}
      <div className="grid gap-2 sm:grid-cols-4">
        <TextInput placeholder="Status" value={status} onChange={(event) => setStatus(event.target.value)} />
        <TextInput placeholder="Token" value={filterToken} onChange={(event) => setFilterToken(event.target.value)} />
        <TextInput type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <TextInput type="date" value={to} onChange={(event) => setTo(event.target.value)} />
      </div>
      <Button type="button" tone="ghost" onClick={() => load()}>Apply filters</Button>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-muted"><tr><th className="py-2">When</th><th>Amount</th><th>Recipient</th><th>Status</th><th>Explorer</th></tr></thead>
          <tbody>
            {rows?.map((tx) => (
              <tr key={tx.id} className="border-t border-border">
                <td className="py-3">{new Date(tx.created_at).toLocaleString()}</td>
                <td>{money(tx.amount_lamports, tx.token)}</td>
                <td className="max-w-40 truncate">{tx.recipient}</td>
                <td>
                  {tx.status}
                  {tx.error ? ` · ${tx.error}` : ""}
                  {tx.status === "submitted" && <button className="ml-2 text-primary" type="button" onClick={() => void refreshFn({ data: tx.id }).then(() => load())}>Refresh</button>}
                </td>
                <td>{tx.explorer ? <a className="text-primary" href={tx.explorer} target="_blank" rel="noreferrer">View</a> : "Not submitted"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows?.length === 0 && <p className="text-sm text-muted">No transactions match.</p>}
    </div>
  );
}
