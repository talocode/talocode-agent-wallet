import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

const links = [
  ["Overview", "/app"],
  ["Agents", "/app/agents"],
  ["Wallets", "/app/wallets"],
  ["Transactions", "/app/transactions"],
  ["Approvals", "/app/approvals"],
  ["Policies", "/app/policies"],
  ["API keys", "/app/keys"],
  ["Developers", "/docs"],
  ["Settings", "/app/settings"],
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const path = useRouterState({ select: (state) => state.location.pathname });
  if (isPending) return <p className="p-8 text-muted">Checking your session…</p>;
  if (!user) return <RedirectToSignIn />;
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src={`${import.meta.env.BASE_URL}brand/talocode-logo.png`} alt="" className="h-8 w-8" />
            <span className="text-sm font-medium">Agent Wallet</span>
          </Link>
          <UserButton />
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3">
          {links.map(([label, href]) => {
            const active = href === "/docs" ? path.startsWith("/docs") : path === href;
            return (
              <Link key={href} to={href} className={`shrink-0 rounded-md px-3 py-2 text-sm ${active ? "bg-primary text-primary-ink" : "text-muted"}`}>
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">{children}</main>
    </div>
  );
}
