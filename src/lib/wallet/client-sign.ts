import { Buffer } from "buffer";
import { Keypair, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { decryptSecret, encryptSecret } from "./crypto";

export type SealedKey = { ciphertext: string; salt: string; iv: string };

function wipe(bytes: Uint8Array) {
  bytes.fill(0);
}

export async function createEncryptedKeypair(passphrase: string): Promise<SealedKey & { publicKey: string }> {
  const keypair = Keypair.generate();
  try {
    const sealed = await encryptSecret(keypair.secretKey, passphrase);
    return { publicKey: keypair.publicKey.toBase58(), ...sealed };
  } finally {
    wipe(keypair.secretKey);
  }
}

export async function importEncryptedKeypair(secretBase58: string, passphrase: string): Promise<SealedKey & { publicKey: string }> {
  const bytes = bs58.decode(secretBase58.trim());
  if (bytes.length !== 64) throw new Error("Paste a base58 secret key (64 bytes). Seed phrases are not accepted.");
  try {
    const keypair = Keypair.fromSecretKey(bytes);
    const sealed = await encryptSecret(keypair.secretKey, passphrase);
    wipe(keypair.secretKey);
    return { publicKey: keypair.publicKey.toBase58(), ...sealed };
  } finally {
    wipe(bytes);
  }
}

export async function signUnsigned(unsigned: string, sealed: SealedKey, passphrase: string): Promise<string> {
  const secret = await decryptSecret(sealed, passphrase);
  try {
    const keypair = Keypair.fromSecretKey(secret);
    const tx = Transaction.from(Buffer.from(unsigned, "base64"));
    tx.partialSign(keypair);
    wipe(keypair.secretKey);
    return Buffer.from(tx.serialize()).toString("base64");
  } finally {
    wipe(secret);
  }
}
