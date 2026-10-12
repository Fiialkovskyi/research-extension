import { describe, expect, it } from "vitest";

import { encryptBytes } from ".";

const buildKey = async () => ({
  id: "data-key-1",
  key: await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]),
});

describe("encryptBytes", () => {
  it("names the key and cipher, and uses a 12-byte IV", async () => {
    const sealed = await encryptBytes(await buildKey(), new TextEncoder().encode("motors"));

    expect(sealed).toMatchObject({ keyId: "data-key-1", cipher: "aes-gcm-256" });
    expect(sealed.iv).toHaveLength(12);
  });

  it("uses a fresh IV each time, so the same bytes encrypt differently", async () => {
    const key = await buildKey();
    const bytes = new TextEncoder().encode("motors");
    const [first, second] = await Promise.all([encryptBytes(key, bytes), encryptBytes(key, bytes)]);

    expect(first.iv).not.toEqual(second.iv);
    expect(new Uint8Array(first.ciphertext)).not.toEqual(new Uint8Array(second.ciphertext));
  });

  it("does not contain the plain bytes", async () => {
    const sealed = await encryptBytes(
      await buildKey(),
      new TextEncoder().encode("mid-drive motor"),
    );

    expect(new TextDecoder().decode(sealed.ciphertext)).not.toContain("mid-drive");
  });
});
