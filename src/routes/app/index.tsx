import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { clusterFn, overviewFn } from "@/lib/wallet/fns";
import { money } from "@/lib/wallet/policy";
import { Notice, Stat, messageOf } from "@/components/ui";

export const Route = createFileRoute("/app/")({ component: Overview });

type OverviewData = Awaited<ReturnType<typeof overviewFn>>;

function Overview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [network, setNetwork] = useState("Checking Devnet…");
  const [error, setError] = useState("");

  useEffect(() => {
    overviewFn().then(setData).catch((cause) => setError(messageOf(cause)));
    clusterFn().then((status) => {
      setNetwork(status.ok ? `Solana Devnet is responding. Slot ${status.slot}. Core ${status.version}.` : status.error);
    }).catch((cause) => setNetwork(messageOf(cause)));
  }, []);

  if (error) return <Notice tone="bad">{error}</Notice>;
  if (!data) return <p className="text-muted">Loading your workspace…</p>;
  const steps = [
    [data.agents > 0, "Create an agent", "/app/agents"],
    [data.wallets > 0, "Create a wallet on this device", "/app/wallets"],
    [data.policies > 0, "Set a spending policy", "/app/policies"],
    [data.pending > 0 || data.recent.length > 0, "Request a payment and sign it", "/app/transactions"],
  ] as const;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-4xl">Overview</h1>
        <p className="mt-1 text-sm text-muted">{network}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Agents" value={String(data.agents)} />
        <Stat label="Active" value={String(data.activeAgents)} />
        <Stat label="Wallets" value={String(data.wallets)} />
        <Stat label="Waiting for you" value={String(data.pending)} />
      </div>
      <p className="text-sm text-muted">
        Confirmed volume: {money(data.confirmedSolLamports, "SOL")} and {money(data.confirmedUsdcBase, "USDC")}. Counts only transactions this workspace has seen confirmed. Devnet tokens are not money.
      </p>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-serif text-2xl">First payment</h2>
        <ol className="mt-3 space-y-2 text-sm">
          {steps.map(([done, label, href]) => (
            <li key={label}>
              <Link to={href} className={done ? "text-primary" : "text-fg"}>{done ? "Done" : "Next"}: {label}</Link>
            </li>
          ))}
        </ol>
      </section>
      <section className="space-y-2">
        <h2 className="font-serif text-2xl">Recent activity</h2>
        {data.recent.length === 0 && <p className="text-sm text-muted">No transactions yet. That is the empty state, not a hidden balance.</p>}
        {data.recent.map((tx) => (
          <p key={tx.id} className="text-sm text-muted">{tx.status} · {money(tx.amount_lamports, tx.token)} → {tx.recipient.slice(0, 6)}…</p>
        ))}
      </section>
    </div>
  );
}
