import assert from "node:assert/strict";
import test from "node:test";
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { USDC_DEVNET_MINT } from "./policy.ts";
import { signedTransferMatches } from "./solana.server.ts";

const BLOCKHASH = "11111111111111111111111111111111";

function signedTransfer(from: Keypair, to: Keypair, lamports: number) {
  const tx = new Transaction({ feePayer: from.publicKey, recentBlockhash: BLOCKHASH });
  tx.add(SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: to.publicKey, lamports }));
  tx.sign(from);
  return tx.serialize().toString("base64");
}

test("a signed SOL transfer must match the approved amount", () => {
  const from = Keypair.generate();
  const to = Keypair.generate();
  const signed = signedTransfer(from, to, 1000);
  const matched = signedTransferMatches(signed, {
    from: from.publicKey.toBase58(),
    to: to.publicKey.toBase58(),
    amountLamports: 1000n,
    token: "SOL",
  });
  assert.ok(matched.length > 32);
  assert.throws(() => signedTransferMatches(signed, {
    from: from.publicKey.toBase58(),
    to: to.publicKey.toBase58(),
    amountLamports: 1001n,
    token: "SOL",
  }));
});

test("a USDC approval cannot hide a SOL transfer", () => {
  const from = Keypair.generate();
  const to = Keypair.generate();
  const mint = new PublicKey(USDC_DEVNET_MINT);
  const source = getAssociatedTokenAddressSync(mint, from.publicKey);
  const dest = getAssociatedTokenAddressSync(mint, to.publicKey);
  const tx = new Transaction({ feePayer: from.publicKey, recentBlockhash: BLOCKHASH });
  tx.add(createTransferCheckedInstruction(source, mint, dest, from.publicKey, 1_000_000n, 6));
  tx.add(SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: to.publicKey, lamports: 1 }));
  tx.sign(from);
  assert.throws(() => signedTransferMatches(tx.serialize().toString("base64"), {
    from: from.publicKey.toBase58(),
    to: to.publicKey.toBase58(),
    amountLamports: 1_000_000n,
    token: "USDC",
  }));
});

test("a matching Devnet USDC transfer is accepted", () => {
  const from = Keypair.generate();
  const to = Keypair.generate();
  const mint = new PublicKey(USDC_DEVNET_MINT);
  const source = getAssociatedTokenAddressSync(mint, from.publicKey);
  const dest = getAssociatedTokenAddressSync(mint, to.publicKey);
  const tx = new Transaction({ feePayer: from.publicKey, recentBlockhash: BLOCKHASH });
  tx.add(createTransferCheckedInstruction(source, mint, dest, from.publicKey, 1_000_000n, 6));
  tx.sign(from);
  const signed = tx.serialize().toString("base64");
  const matched = signedTransferMatches(signed, {
    from: from.publicKey.toBase58(),
    to: to.publicKey.toBase58(),
    amountLamports: 1_000_000n,
    token: "USDC",
  });
  assert.ok(matched.length > 32);
});
