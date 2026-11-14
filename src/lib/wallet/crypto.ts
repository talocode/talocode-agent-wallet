const encoder = new TextEncoder();

function bytesToB64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function b64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 210_000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSecret(secret: Uint8Array, passphrase: string): Promise<{ ciphertext: string; salt: string; iv: string }> {
  if (passphrase.length < 8) throw new Error("Use a passphrase of at least 8 characters.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, secret as BufferSource);
  return { ciphertext: bytesToB64(new Uint8Array(encrypted)), salt: bytesToB64(salt), iv: bytesToB64(iv) };
}

export async function decryptSecret(payload: { ciphertext: string; salt: string; iv: string }, passphrase: string): Promise<Uint8Array> {
  const key = await deriveKey(passphrase, b64ToBytes(payload.salt));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBytes(payload.iv) as BufferSource },
    key,
    b64ToBytes(payload.ciphertext) as BufferSource,
  );
  return new Uint8Array(plain);
}
