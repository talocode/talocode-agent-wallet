import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { authClient, authEnabled, GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { Button, Field, messageOf, Notice, TextInput } from "@/components/ui";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "up") {
        const result = await authClient.signUp.email({ email, password, name: name || email, callbackURL: "/app" });
        if (result.error) throw new Error(result.error.message || "Could not create the account.");
      } else {
        const result = await authClient.signIn.email({ email, password, callbackURL: "/app" });
        if (result.error) throw new Error(result.error.message || "Could not sign in.");
      }
      await navigate({ to: "/app" });
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-4 py-10">
      <div className="w-full space-y-5">
        <Link to="/" className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}brand/talocode-logo.png`} alt="" className="h-8 w-8" />
          <span className="text-sm">Talocode Agent Wallet</span>
        </Link>
        <h1 className="font-serif text-4xl">Sign in</h1>
        {authEnabled ? (
          <>
            <div className="space-y-2">
              {GROK_PROVIDERS.map((provider) => (
                <Button key={provider.providerId} type="button" tone="ghost" className="w-full" onClick={() => void signIn(provider.providerId, { callbackURL: "/app" })}>
                  Continue with {provider.label}
                </Button>
              ))}
            </div>
            <form className="space-y-3" onSubmit={(event) => void submitEmail(event)}>
              {mode === "up" && (
                <Field label="Name">
                  <TextInput value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
                </Field>
              )}
              <Field label="Email">
                <TextInput type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
              </Field>
              <Field label="Password">
                <TextInput type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "up" ? "new-password" : "current-password"} />
              </Field>
              <Button type="submit" className="w-full" disabled={busy}>{mode === "up" ? "Create account" : "Sign in with email"}</Button>
              <button type="button" className="text-sm text-muted" onClick={() => setMode(mode === "up" ? "in" : "up")}>
                {mode === "up" ? "Already have an account? Sign in" : "New here? Create an account"}
              </button>
            </form>
          </>
        ) : (
          <Notice>Sign-in is disabled.</Notice>
        )}
        {error && <Notice tone="bad">{error}</Notice>}
      </div>
    </main>
  );
}
