import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { auditFn } from "@/lib/wallet/fns";
import { USDC_DEVNET_MINT } from "@/lib/wallet/policy";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { messageOf, Notice } from "@/components/ui";

export const Route = createFileRoute("/app/settings")({ component: SettingsPage });

function SettingsPage() {
  const user = useCurrentUser();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof auditFn>>>([]);
  const [error, setError] = useState("");
  useEffect(() => { auditFn().then(setRows).catch((cause) => setError(messageOf(cause))); }, []);
  return (
    <div className="space-y-5">
      <h1 className="font-serif text-4xl">Settings</h1>
      <section className="rounded-lg border border-border bg-surface p-4 text-sm">
        <h2 className="font-serif text-2xl">Profile</h2>
        <p className="mt-2">{user?.displayName || "Developer"}</p>
        <p className="text-muted">{user?.primaryEmail || "No email on this session."}</p>
        <p className="mt-2 text-muted">The name and email come from the sign-in provider. There is no separate profile editor.</p>
      </section>
      <section className="space-y-2 text-sm text-muted">
        <h2 className="font-serif text-2xl text-fg">Network</h2>
        <p>Solana Devnet via https://api.devnet.solana.com. This cannot be switched to mainnet in the product.</p>
        <p>Devnet USDC mint {USDC_DEVNET_MINT}. Circle test token. No monetary value.</p>
        <p>A stolen session can download ciphertext. It still needs the passphrase. There is no recovery if you forget it.</p>
        <p>Policy checks run before signing. They are application rules, not a Solana program. A key exported from this device can ignore them.</p>
        <p>API rate limits live in process memory. A restart clears them. Webhooks are not implemented.</p>
      </section>
      {error && <Notice tone="bad">{error}</Notice>}
      <section>
        <h2 className="font-serif text-2xl">Audit log</h2>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {rows.map((row) => <li key={row.id}>{row.action} · {row.detail}</li>)}
          {rows.length === 0 && <li>No audit events yet.</li>}
        </ul>
      </section>
    </div>
  );
}
