# Architecture

Talocode Agent Wallet is one web app.

- The interface is TanStack Start, React, and Tailwind.
- Accounts are Better Auth. Data is Postgres (Neon when deployed, a local Postgres-compatible database in preview).
- Solana calls use `@solana/web3.js` 1.98 and `@solana/spl-token` against `https://api.devnet.solana.com`.
- The policy engine in `src/lib/wallet/policy.ts` is pure and tested. The store in `src/lib/wallet/store.server.ts` is the only place that writes payments.
- Signing is `src/lib/wallet/client-sign.ts`. A later delegated signer would replace that module. Nothing in the API assumes the server has a key.

## Payment path

1. An agent request hits a server function or `POST /api/v1/transactions`.
2. The policy runs. A failure does not create a spendable row.
3. A passing request is stored as `awaiting_approval`.
4. The browser asks for the unsigned transaction and the ciphertext.
5. The passphrase decrypts the key locally. The signed bytes go back.
6. The server checks the bytes match the row, submits them, and stores the signature.
7. Status becomes `confirmed` only after the cluster says so. Otherwise `submitted` or `failed`.

## Networks that are not built

The network value is fixed to `solana-devnet`. The policy rejects anything else. Adding mainnet later means a separate signer review, real fee handling, and an explicit user opt-in. It is not a config flag today.

## SDK and MCP

Both are thin clients of the REST API. They are in this repository so the contract stays next to the server. They are not published to npm in this version.
