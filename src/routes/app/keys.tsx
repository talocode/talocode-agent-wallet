import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createKeyFn, keysFn, revokeKeyFn, usageFn } from "@/lib/wallet/fns";
import { Button, Field, messageOf, Notice, Panel, TextInput } from "@/components/ui";

export const Route = createFileRoute("/app/keys")({ component: KeysPage });

function KeysPage() {
  const [keys, setKeys] = useState<Awaited<ReturnType<typeof keysFn>> | null>(null);
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState("read,transact");
  const [secret, setSecret] = useState("");
  const [usage, setUsage] = useState("");
  const [error, setError] = useState("");

  function load() {
    keysFn().then(setKeys).catch((cause) => setError(messageOf(cause)));
    usageFn().then((row) => setUsage(`${row.activeKeys} active keys. ${row.rateLimit}`)).catch(() => undefined);
  }
  useEffect(load, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-4xl">API keys</h1>
        <p className="mt-1 text-sm text-muted">The secret is shown once and stored as a SHA-256 hash. A key can read, or read and request payments. It cannot sign.</p>
      </div>
      <Panel title="New key">
        <form className="grid gap-3" onSubmit={(event) => {
          event.preventDefault();
          setSecret("");
          createKeyFn({ data: { name, permissions } }).then((row) => { setSecret(row.secret); setName(""); load(); }).catch((cause) => setError(messageOf(cause)));
        }}>
          <Field label="Name"><TextInput value={name} onChange={(event) => setName(event.target.value)} required /></Field>
          <Field label="Permissions">
            <select className="h-11 rounded-md border border-border bg-bg px-3" value={permissions} onChange={(event) => setPermissions(event.target.value)}>
              <option value="read">read</option>
              <option value="read,transact">read and transact</option>
            </select>
          </Field>
          <Button type="submit">Create key</Button>
        </form>
      </Panel>
      {secret && <Notice>Copy this now. It will not be shown again: {secret}</Notice>}
      {usage && <p className="text-sm text-muted">{usage}</p>}
      {error && <Notice tone="bad">{error}</Notice>}
      {keys?.map((key) => (
        <article key={String(key.id)} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4 text-sm">
          <div>
            <p className="font-medium">{String(key.name)}</p>
            <p className="text-muted">{String(key.prefix)}… · {String(key.permissions)} · {key.revoked_at ? "revoked" : "active"}</p>
          </div>
          {!key.revoked_at && <Button type="button" tone="ghost" onClick={() => void revokeKeyFn({ data: String(key.id) }).then(load).catch((cause) => setError(messageOf(cause)))}>Revoke</Button>}
        </article>
      ))}
    </div>
  );
}
