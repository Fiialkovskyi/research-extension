import { describe, expect, it } from "vitest";

import { decryptBytes } from ".";
import { encryptBytes } from "../encryptBytes";

const buildKey = async (id = "data-key-1") => ({
  id,
  key: await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]),
});

const BYTES = new TextEncoder().encode("Mid-drive motors sit at the cranks.");

describe("decryptBytes", () => {
  it("returns what was encrypted", async () => {
    const key = await buildKey();
    const plain = await decryptBytes(key, await encryptBytes(key, BYTES));

    expect(new TextDecoder().decode(plain)).toBe("Mid-drive motors sit at the cranks.");
  });

  it("refuses content with one byte changed", async () => {
    const key = await buildKey();
    const sealed = await encryptBytes(key, BYTES);
    const altered = new Uint8Array(sealed.ciphertext.slice(0));

    altered[0] = (altered[0] ?? 0) ^ 1;

    await expect(decryptBytes(key, { ...sealed, ciphertext: altered.buffer })).rejects.toThrow(
      "failed authentication",
    );
  });

  it("refuses content sealed by another key or cipher", async () => {
    const key = await buildKey();
    const sealed = await encryptBytes(key, BYTES);

    await expect(decryptBytes(await buildKey("data-key-2"), sealed)).rejects.toThrow(
      'not by the data key "data-key-2"',
    );
    await expect(
      decryptBytes(key, { ...sealed, cipher: "rot13" as "aes-gcm-256" }),
    ).rejects.toThrow("unknown cipher");
  });
});
