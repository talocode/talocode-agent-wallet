import { createHash } from "node:crypto";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  type ParsedAccountData,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { NETWORK, USDC_DEVNET_MINT, formatLamports } from "./policy.ts";

const RPC = "https://api.devnet.solana.com";
export const connection = new Connection(RPC, "confirmed");

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function assertAddress(value: string): PublicKey {
  try {
    const key = new PublicKey(value);
    if (key.toBase58() !== value) throw new Error("bad");
    return key;
  } catch {
    throw new Error("That is not a Solana address.");
  }
}

export async function clusterStatus(): Promise<{ ok: true; slot: number; version: string } | { ok: false; error: string }> {
  try {
    const [version, slot] = await Promise.all([connection.getVersion(), connection.getSlot("confirmed")]);
    return { ok: true, slot, version: version["solana-core"] ?? "unknown" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Devnet RPC did not respond." };
  }
}

export async function readBalances(address: string): Promise<{ sol: string; usdc: string }> {
  const owner = assertAddress(address);
  const lamports = await connection.getBalance(owner, "confirmed");
  let usdc = "0";
  try {
    const mint = new PublicKey(USDC_DEVNET_MINT);
    const ata = await getAssociatedTokenAddress(mint, owner);
    const account = await connection.getParsedAccountInfo(ata, "confirmed");
    const parsed = account.value?.data as ParsedAccountData | undefined;
    const amount = parsed?.parsed?.info?.tokenAmount?.uiAmountString;
    if (typeof amount === "string") usdc = amount;
  } catch {
    usdc = "0";
  }
  return { sol: formatLamports(BigInt(lamports), 9), usdc };
}

export async function requestDevnetSol(address: string): Promise<string> {
  const owner = assertAddress(address);
  const signature = await connection.requestAirdrop(owner, 1_000_000_000);
  return signature;
}

export async function buildTransfer(input: {
  from: string;
  to: string;
  amountLamports: bigint;
  token: "SOL" | "USDC";
}): Promise<{ unsigned: string; feeLamports: number | null }> {
  const from = assertAddress(input.from);
  const to = assertAddress(input.to);
  if (input.amountLamports > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Amount is too large to encode safely.");
  }
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction();
  tx.feePayer = from;
  tx.recentBlockhash = blockhash;
  if (input.token === "SOL") {
    tx.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports: Number(input.amountLamports) }));
  } else {
    const mint = new PublicKey(USDC_DEVNET_MINT);
    const source = await getAssociatedTokenAddress(mint, from);
    const dest = await getAssociatedTokenAddress(mint, to);
    tx.add(createAssociatedTokenAccountIdempotentInstruction(from, dest, to, mint));
    tx.add(createTransferCheckedInstruction(source, mint, dest, from, input.amountLamports, 6));
  }
  let feeLamports: number | null = null;
  try {
    const fee = await connection.getFeeForMessage(tx.compileMessage(), "confirmed");
    feeLamports = fee.value;
  } catch {
    feeLamports = null;
  }
  return {
    unsigned: Buffer.from(tx.serialize({ requireAllSignatures: false, verifySignatures: false })).toString("base64"),
    feeLamports,
  };
}

export function signedTransferMatches(signedBase64: string, expected: {
  from: string;
  to: string;
  amountLamports: bigint;
  token: "SOL" | "USDC";
}): Buffer {
  const raw = Buffer.from(signedBase64, "base64");
  const tx = Transaction.from(raw);
  if (!tx.verifySignatures(false)) throw new Error("The signature does not verify for this transaction.");
  if (!tx.feePayer?.equals(assertAddress(expected.from))) throw new Error("The signed transaction fee payer does not match this wallet.");
  if (tx.signatures.some((entry) => !entry.signature)) throw new Error("The transaction is not signed.");
  if (expected.token === "SOL") {
    if (tx.instructions.length !== 1) throw new Error("The signed transaction is not the SOL transfer that was approved.");
    const ix = tx.instructions[0];
    if (!ix.programId.equals(SystemProgram.programId)) throw new Error("Unexpected program.");
    const data = Buffer.from(ix.data);
    if (data.readUInt32LE(0) !== 2) throw new Error("Unexpected instruction.");
    const lamports = data.readBigUInt64LE(4);
    if (lamports !== expected.amountLamports) throw new Error("The signed amount does not match the approval.");
    if (!ix.keys[0]?.pubkey.equals(assertAddress(expected.from))) throw new Error("The source does not match.");
    if (!ix.keys[1]?.pubkey.equals(assertAddress(expected.to))) throw new Error("The recipient does not match.");
  } else {
    if (tx.instructions.length < 1 || tx.instructions.length > 2) {
      throw new Error("The signed transaction is not the USDC transfer that was approved.");
    }
    for (const ix of tx.instructions) {
      if (!ix.programId.equals(TOKEN_PROGRAM_ID) && !ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)) {
        throw new Error("The signed transaction includes a program that was not approved.");
      }
    }
    const from = assertAddress(expected.from);
    const to = assertAddress(expected.to);
    const mint = new PublicKey(USDC_DEVNET_MINT);
    const source = getAssociatedTokenAddressSync(mint, from);
    const dest = getAssociatedTokenAddressSync(mint, to);
    const match = tx.instructions.find((ix) => ix.programId.equals(TOKEN_PROGRAM_ID) && Buffer.from(ix.data)[0] === 12);
    if (!match || Buffer.from(match.data).length < 9) throw new Error("The signed transaction is not the USDC transfer that was approved.");
    const amount = Buffer.from(match.data).readBigUInt64LE(1);
    if (amount !== expected.amountLamports) throw new Error("The signed USDC amount does not match the approval.");
    if (!match.keys[0]?.pubkey.equals(source)) throw new Error("The USDC source does not match this wallet.");
    if (!match.keys[1]?.pubkey.equals(mint)) throw new Error("The token mint is not Devnet USDC.");
    if (!match.keys[2]?.pubkey.equals(dest)) throw new Error("The USDC recipient does not match the approval.");
    if (!match.keys[3]?.pubkey.equals(from)) throw new Error("The USDC owner does not match this wallet.");
  }
  return raw;
}

export async function broadcastSigned(raw: Buffer): Promise<string> {
  return connection.sendRawTransaction(raw, { skipPreflight: false, preflightCommitment: "confirmed" });
}

export async function confirmSignature(signature: string): Promise<{ confirmed: boolean; error: string | null }> {
  try {
    const latest = await connection.getLatestBlockhash("confirmed");
    const result = await connection.confirmTransaction(
      { signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
      "confirmed",
    );
    const err = result.value.err;
    return { confirmed: !err, error: err ? JSON.stringify(err) : null };
  } catch (error) {
    const status = await signatureStatus(signature).catch(() => "submitted" as const);
    if (status === "confirmed") return { confirmed: true, error: null };
    const message = error instanceof Error ? error.message : "Devnet did not confirm this transaction.";
    return { confirmed: false, error: message };
  }
}

export async function submitAndConfirm(raw: Buffer): Promise<{ signature: string; confirmed: boolean; error: string | null }> {
  const signature = await broadcastSigned(raw);
  const result = await confirmSignature(signature);
  return { signature, ...result };
}

export async function signatureStatus(signature: string): Promise<"confirmed" | "failed" | "submitted"> {
  const status = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
  const value = status.value[0];
  if (!value) return "submitted";
  if (value.err) return "failed";
  if (value.confirmationStatus === "confirmed" || value.confirmationStatus === "finalized") return "confirmed";
  return "submitted";
}

export function explorerUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function addressUrl(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}

export { NETWORK };
