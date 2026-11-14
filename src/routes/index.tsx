import { createFileRoute, Link } from "@tanstack/react-router";
import { SignedIn, SignedOut } from "@/lib/auth/gates";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
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
            <li>REST API, a TypeScript client, and an MCP server that can request a payment and cannot sign it.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
