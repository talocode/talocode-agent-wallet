import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { rejectFn, transactionsFn } from "@/lib/wallet/fns";
import { money } from "@/lib/wallet/policy";
import { SignPanel } from "@/components/sign-panel";
import { Button, messageOf, Notice } from "@/components/ui";

export const Route = createFileRoute("/app/approvals")({ component: ApprovalsPage });

function ApprovalsPage() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof transactionsFn>> | null>(null);
  const [open, setOpen] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  function load() {
    transactionsFn({ data: { status: "awaiting_approval" } }).then(setRows).catch((cause) => setError(messageOf(cause)));
  }
  useEffect(load, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-4xl">Approvals</h1>
        <p className="mt-1 text-sm text-muted">A request can sit here only after the policy check passed. Approving means you sign. Rejecting leaves it unsent.</p>
      </div>
      {error && <Notice tone="bad">{error}</Notice>}
      {note && <Notice>{note}</Notice>}
      {rows?.length === 0 && <p className="text-sm text-muted">Nothing is waiting. Request a payment from Transactions.</p>}
      {rows?.map((tx) => (
        <article key={tx.id} className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-serif text-2xl">{money(tx.amount_lamports, tx.token)}</h2>
          <p className="break-all text-sm">To {tx.recipient}</p>
          <p className="text-sm text-muted">{tx.network} · agent {tx.agent_id} · wallet {tx.wallet_id}</p>
          <div className="flex gap-2">
            <Button type="button" tone="ghost" onClick={() => setOpen(open === tx.id ? "" : tx.id)}>Review and sign</Button>
            <Button type="button" tone="ghost" onClick={() => void rejectFn({ data: tx.id }).then(load).catch((cause) => setError(messageOf(cause)))}>Reject</Button>
          </div>
          {open === tx.id && <SignPanel txId={tx.id} onDone={(explorer, status) => { setNote(`${status}${explorer ? `. ${explorer}` : ""}`); setOpen(""); load(); }} />}
        </article>
      ))}
    </div>
  );
}
