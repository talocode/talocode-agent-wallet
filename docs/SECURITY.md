# Security notes

Talocode Agent Wallet is a Devnet MVP. These are the controls that exist, and the ones that do not.

## What is enforced

- Accounts use the app's Better Auth sessions (Google, X, email and password).
- Every dashboard query is scoped to the signed-in user id from the session, not from the browser payload.
- API keys are random, shown once, and stored as SHA-256 hashes. Revoked keys stop working.
- Transaction creation checks the spending policy on the server. That check is an application rule. It is not a Solana program and it is not enforced on-chain. A key exported outside this app can ignore it.
- Submitting a payment claims the row first (`awaiting_approval` to `submitted`). A second submit of the same approval is rejected unless a signature was already stored. The signature is saved as soon as Devnet accepts the bytes. Status becomes `confirmed` only when the cluster reports the signature confirmed or finalized.
- The same idempotency key returns the original payment. A different payload with that key is rejected.
- Before submit, the server decodes the signed transaction, verifies the signature, and checks the fee payer. A SOL payment must be exactly one system transfer of the approved amount. A USDC payment may only use the token program and the associated-token program, and the mint, source, owner, and recipient account must match the approval. An extra SOL transfer inside a USDC approval is rejected.
- API key hashes are used as the rate-limit key. The raw key is not kept in that map. The secret is shown once and stored as SHA-256.
- Audit rows store an action and a short public detail. Passphrases are not a field anywhere.

## What is not a cryptographic lock

- The server cannot sign, including when the review checkbox is off. Unchecking it only changes the message.
- The browser must receive ciphertext to decrypt it. A cross-site script in this origin, or a stolen session plus the passphrase, can sign. The passphrase is held only in component memory and cleared after the attempt. It is not written to localStorage.
- There is no private-key export screen. Import accepts a base58 secret on this device, encrypts it, and discards the plaintext. Paste that only on a machine you trust.
- Rate limits are an in-memory counter keyed by the key hash, capped so unknown keys cannot grow the map without bound. They reset on restart and are not shared across instances.
- CORS on the API is open because callers send a bearer key, not a cookie. Do not put the key in a page that other sites can read.
- Devnet RPC is a public endpoint. Balances and airdrops can fail or lag. Failed calls are shown as failures.
- Webhooks are not implemented. Do not point a worker at a URL that this app does not call.
- Mainnet, Base, and Ethereum are rejected on purpose. There is no bridge and no token.

## Devnet USDC

Mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` is Circle's Devnet USDC. It has no monetary value.

## Operator variables

The hosted app receives its database URL and auth credentials from the platform. Do not commit them. API keys belong in the developer's own secret store. The MCP example uses the names `TALOCODE_BASE_URL` and `TALOCODE_API_KEY`.
