import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { publicHealth } from "@/lib/wallet/public-api";

export const Route = createFileRoute("/")({
  loader: () => ({ health: publicHealth() }),
  component: Home,
});

const surfaces = [
  ["npm", "@talocode/agent-wallet", "Packaged SDK, CLI, and MCP. MIT. The client never holds a key."],
  ["CLI", "talocode-wallet", "health, agents, wallets, policies, payments request. A request is not a signature."],
  ["MCP", "talocode-wallet mcp", "Same tools over stdio. There is no sign_transaction tool."],
  ["API", "GET /api/v1/health", "Public liveness and capabilities. Payments still need a bearer key."],
];

function HostedApi({ expected }: { expected: string }) {
  const [body, setBody] = useState(expected);
  const [source, setSource] = useState("Rendered from the same function the route returns.");
  useEffect(() => {
    const prefix = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
    fetch(`${prefix}api/v1/health`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error("Health route failed.");
        setBody(JSON.stringify(payload, null, 2));
        setSource("Fetched from GET /api/v1/health.");
      })
      .catch(() => setSource("The HTTP health route did not answer. The payload below is still the route function."));
  }, [expected]);
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">{source}</p>
      <pre className="overflow-x-auto rounded-lg border border-border bg-bg p-4 text-sm text-fg">{body}</pre>
    </div>
  );
}

function Home() {
  const { health } = Route.useLoaderData();
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}brand/talocode-logo.png`} alt="" className="h-9 w-9" />
          <span className="text-sm font-medium">Talocode</span>
        </div>
        <div className="flex gap-2">
          <Link to="/docs" className="inline-flex h-11 items-center px-3 text-sm text-muted">Docs</Link>
          <SignedOut>
            <Link to="/login" className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-ink">Sign in</Link>
          </SignedOut>
          <SignedIn>
            <Link to="/app" className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-ink">Open dashboard</Link>
          </SignedIn>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-12 px-4 py-10">
        <section className="max-w-3xl space-y-4">
          <p className="text-sm uppercase tracking-wide text-primary">Solana Devnet</p>
          <h1 className="font-serif text-5xl leading-tight text-fg">Give your AI agents a wallet. Set the rules. Stay in control.</h1>
          <p className="text-lg text-muted">Talocode Agent Wallet is financial infrastructure for agents that need to request payments. You hold the keys. The server never signs.</p>
          <div className="flex flex-wrap gap-3">
            <Link to="/login" className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-ink">Create a developer account</Link>
            <Link to="/docs" className="inline-flex h-11 items-center rounded-md border border-border px-4 text-sm">Read the quickstart</Link>
          </div>
        </section>
        <section className="grid gap-3 sm:grid-cols-2">
          {surfaces.map(([title, command, body]) => (
            <article key={title} className="rounded-lg border border-border bg-surface p-4">
              <p className="text-sm uppercase tracking-wide text-primary">{title}</p>
              <h2 className="mt-1 font-serif text-2xl">{command}</h2>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </article>
          ))}
        </section>
        <section className="space-y-3">
          <h2 className="font-serif text-3xl">Hosted API, live</h2>
          <p className="text-sm text-muted">This is the public health route from this app. It does not call Devnet and it does not sign.</p>
          <HostedApi expected={JSON.stringify(health, null, 2)} />
        </section>
        <section className="grid gap-3 sm:grid-cols-3">
          {[
            ["Agents", "Name the workers that can request money. Pause them when you want the requests to stop."],
            ["Policies", "Cap a payment, a day, and a month. Limit tokens and recipients before a signature is even offered."],
            ["Your signature", "Keys are created in the browser and sealed with your passphrase. Talocode stores ciphertext, not a usable secret."],
          ].map(([title, body]) => (
            <article key={title} className="rounded-lg border border-border bg-surface p-4">
              <h2 className="font-serif text-2xl">{title}</h2>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </article>
          ))}
        </section>
        <section className="rounded-lg border border-border p-4">
          <h2 className="font-serif text-2xl">What this version does</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>Solana Devnet only. Mainnet, Base, and Ethereum are not connected.</li>
            <li>SOL transfers, and SPL transfers of Circle Devnet USDC. Those tokens have no monetary value.</li>
            <li>Every payment, including one inside the policy, needs an owner signature on this device.</li>
            <li>One package: npm client, CLI, MCP server, and the hosted REST API. None of them can sign.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}