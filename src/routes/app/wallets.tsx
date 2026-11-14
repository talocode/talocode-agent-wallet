import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { agentsFn, airdropFn, assignWalletFn, balanceFn, createWalletFn, walletsFn } from "@/lib/wallet/fns";
import { createEncryptedKeypair, importEncryptedKeypair } from "@/lib/wallet/client-sign";
import { Button, Field, messageOf, Notice, Panel, TextInput } from "@/components/ui";

export const Route = createFileRoute("/app/wallets")({ component: WalletsPage });

function WalletsPage() {
  const [wallets, setWallets] = useState<Awaited<ReturnType<typeof walletsFn>> | null>(null);
  const [agents, setAgents] = useState<Awaited<ReturnType<typeof agentsFn>>>([]);
  const [agentId, setAgentId] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [again, setAgain] = useState("");
  const [secret, setSecret] = useState("");
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  function load() {
    walletsFn().then(setWallets).catch((cause) => setError(messageOf(cause)));
    agentsFn().then(setAgents).catch(() => undefined);
  }
  useEffect(load, []);

  async function save(kind: "new" | "import") {
    setError("");
    setNote("");
    if (passphrase.length < 8) return setError("Use a passphrase of at least 8 characters.");
    if (passphrase !== again) return setError("The two passphrases do not match.");
    try {
      const sealed = kind === "new" ? await createEncryptedKeypair(passphrase) : await importEncryptedKeypair(secret, passphrase);
      setSecret("");
      setPassphrase("");
      setAgain("");
      const created = await createWalletFn({ data: { agentId: agentId || null, ...sealed } });
      setNote(`Wallet ${created.publicKey} is stored as ciphertext. Talocode cannot recover the passphrase.`);
      load();
    } catch (cause) {
      setSecret("");
      setError(messageOf(cause));
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-4xl">Wallets</h1>
        <p className="mt-1 text-sm text-muted">Solana Devnet. Keys are generated here and sealed with AES-GCM. The passphrase never leaves this page.</p>
      </div>
      <Panel title="Create on this device">
        <div className="grid gap-3">
          <Field label="Attach to agent">
            <select className="h-11 w-full rounded-md border border-border bg-bg px-3" value={agentId} onChange={(event) => setAgentId(event.target.value)}>
              <option value="">Unassigned</option>
              {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
            </select>
          </Field>
          <Field label="Passphrase"><TextInput type="password" autoComplete="new-password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} /></Field>
          <Field label="Repeat passphrase"><TextInput type="password" autoComplete="new-password" value={again} onChange={(event) => setAgain(event.target.value)} /></Field>
          <Button type="button" onClick={() => void save("new")}>Generate wallet</Button>
        </div>
      </Panel>
      <details className="rounded-lg border border-border bg-surface p-4">
        <summary className="cursor-pointer text-sm">Import a secret key you already control</summary>
        <p className="mt-2 text-sm text-muted">Paste a base58 secret key. It is encrypted in the browser and wiped from the field. Seed phrases are rejected. Do this only on a device you trust.</p>
        <Field label="Secret key">
          <TextInput type="password" autoComplete="off" value={secret} onChange={(event) => setSecret(event.target.value)} />
        </Field>
        <Button type="button" className="mt-3" tone="ghost" onClick={() => void save("import")}>Encrypt and store</Button>
      </details>
      {note && <Notice>{note}</Notice>}
      {error && <Notice tone="bad">{error}</Notice>}
      {wallets?.length === 0 && <p className="text-sm text-muted">No wallets yet.</p>}
      {wallets?.map((wallet) => (
        <article key={wallet.id} className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <p className="break-all font-medium">{wallet.public_key}</p>
          <p className="text-xs text-muted">{wallet.network} · {wallet.id}</p>
          <p className="text-sm">{balances[wallet.id] ?? "Balance not loaded."}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" tone="ghost" onClick={() => void balanceFn({ data: wallet.id }).then((row) => setBalances((current) => ({ ...current, [wallet.id]: `${row.sol} SOL · ${row.usdc} USDC. ${row.note}` }))).catch((cause) => setError(messageOf(cause)))}>Refresh balance</Button>
            <Button type="button" tone="ghost" onClick={() => void airdropFn({ data: wallet.id }).then((row) => setNote(`Airdrop submitted. Status ${row.status}.`)).catch((cause) => setError(messageOf(cause)))}>Request 1 Devnet SOL</Button>
            <a className="inline-flex h-11 items-center text-sm text-primary" href={wallet.explorer} target="_blank" rel="noreferrer">Explorer</a>
          </div>
          <p className="text-xs text-muted">The public RPC faucet often returns 410. If it does, request test SOL at faucet.solana.com for this address. Nothing here is marked successful unless the cluster returns a signature.</p>
          <Field label="Agent">
            <select className="h-11 w-full rounded-md border border-border bg-bg px-3" value={wallet.agent_id ?? ""} onChange={(event) => void assignWalletFn({ data: { walletId: wallet.id, agentId: event.target.value || null } }).then(load).catch((cause) => setError(messageOf(cause)))}>
              <option value="">Unassigned</option>
              {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
            </select>
          </Field>
        </article>
      ))}
    </div>
  );
}
