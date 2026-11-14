import assert from "node:assert/strict";
import test from "node:test";
import { decryptSecret, encryptSecret } from "./crypto.ts";

test("AES-GCM round trip stays on this device", async () => {
  const secret = crypto.getRandomValues(new Uint8Array(64));
  const sealed = await encryptSecret(secret, "wallet-pass");
  assert.equal(sealed.ciphertext.includes(Buffer.from(secret).toString("base64")), false);
  const opened = await decryptSecret(sealed, "wallet-pass");
  assert.deepEqual(opened, secret);
  await assert.rejects(() => decryptSecret(sealed, "wrong-pass"));
});

test("a short passphrase is refused before encryption", async () => {
  await assert.rejects(() => encryptSecret(new Uint8Array(64), "short"));
});
