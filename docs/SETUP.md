# Setup

This app is meant to run as the hosted Talocode Agent Wallet preview. You do not create a `.env` file in this workspace. The platform injects the database and auth settings when the app is deployed.

## What a self-hosted operator would set

- `DATABASE_URL` for Postgres.
- The Better Auth secrets the platform already wires for Google and X.
- No Solana private key. There is not one.

Developers using the API set, on their own machines:

- `TALOCODE_API_KEY` from the dashboard. It starts with `tk_`.
- `TALOCODE_BASE_URL` as the origin of this app, with no trailing path.

## Local checks

Policy tests and the SDK test do not need a funded wallet. A real Devnet send needs an airdrop, which the public RPC may refuse when it is rate-limited.

## Domain

The intended public host is `agent-wallet.talocode.site`.

DNS is not configured from this repository. After a Netlify site exists, add:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | agent-wallet | the site's `*.netlify.app` hostname |

Netlify may also show a TXT record for domain verification. Copy that value from the domain panel. Do not invent one. Do not attach this app to the Tera site.

## Netlify

`netlify.toml` builds with `npm run build` and publishes `dist/client`. Netlify sets `NETLIFY=true`, which selects `@netlify/vite-plugin-tanstack-start` instead of the Vercel Nitro preset used by the Grok preview.

Accounts and payment rows need a real Postgres `DATABASE_URL`. The embedded database is in-memory and does not survive a serverless cold start. Set `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` to the public origin before expecting sign-in to persist. Solana Devnet RPC is public and does not need a key.

## Fund a wallet

`requestAirdrop` on `https://api.devnet.solana.com` returns HTTP 410. A person should open https://faucet.solana.com, choose Devnet, and request SOL to the wallet public key. Then refresh the balance and approve a payment that is smaller than the balance plus the fee.

