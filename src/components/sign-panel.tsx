import { useState } from "react";
import { cipherFn, prepareFn, submitFn } from "@/lib/wallet/fns";
import { signUnsigned } from "@/lib/wallet/client-sign";
import { Button, Field, messageOf, Notice, TextInput } from "./ui";

export function SignPanel({ txId, onDone }: { txId: string; onDone: (explorer: string | null, status: string) => void }) {
  const [passphrase, setPassphrase] = useState("");
  const [preview, setPreview] = useState<{ feeLamports: number | null; simulation: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function prepare() {
    setBusy(true);
    setError("");
    try {
      const next = await prepareFn({ data: txId });
      setPreview({ feeLamports: next.feeLamports, simulation: next.simulation });
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPassphrase("");
      setBusy(false);
    }
  }

  async function sign() {
    setBusy(true);
    setError("");
    try {
      const prepared = await prepareFn({ data: txId });
      const sealed = await cipherFn({ data: prepared.walletId });
      const signed = await signUnsigned(prepared.unsigned, sealed, passphrase);
      setPassphrase("");
      const result = await submitFn({ data: { id: txId, signed } });
      onDone(result.explorer, result.status);
    } catch (cause) {
      setPassphrase("");
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <p className="text-sm text-muted">The passphrase decrypts the key in this browser. It is not sent to Talocode. The server checks the signed transaction matches this approval, then submits it.</p>
      {preview && (
        <p className="text-sm text-fg">
          Fee estimate: {preview.feeLamports === null ? "unavailable" : `${preview.feeLamports} lamports`}. {preview.simulation}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" tone="ghost" disabled={busy} onClick={() => void prepare()}>Preview and simulate</Button>
      </div>
      <Field label="Wallet passphrase">
        <TextInput type="password" autoComplete="off" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} />
      </Field>
      <Button type="button" disabled={busy || passphrase.length < 8} onClick={() => void sign()}>{busy ? "Working…" : "Sign and submit"}</Button>
      {error && <Notice tone="bad">{error}</Notice>}
    </div>
  );
}
