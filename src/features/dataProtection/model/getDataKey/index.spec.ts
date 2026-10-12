import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDataKey } from ".";
import { KEY_STORE, openResearchDatabase } from "@/shared/storage";

beforeEach(async () => {
  const database = await openResearchDatabase();

  await database.clear(KEY_STORE);
  database.close();
});

const encryptWith = (key: CryptoKey, iv: Uint8Array<ArrayBuffer>) =>
  crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode("motors"));

describe("getDataKey", () => {
  it("creates one key on first need, and finds the same key through a new handle", async () => {
    const first = await openResearchDatabase();
    const created = await getDataKey(first);

    first.close();

    const second = await openResearchDatabase();
    const found = await getDataKey(second);
    const iv = new Uint8Array(12);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      found.key,
      await encryptWith(created.key, iv),
    );

    expect(found.id).toBe(created.id);
    expect(new TextDecoder().decode(plain)).toBe("motors");
    expect(await second.count(KEY_STORE)).toBe(1);
  });

  it("makes a 256-bit AES-GCM key that cannot be read out", async () => {
    const { key } = await getDataKey(await openResearchDatabase());

    expect(key.extractable).toBe(false);
    expect(key.algorithm).toMatchObject({ name: "AES-GCM", length: 256 });
    await expect(crypto.subtle.exportKey("raw", key)).rejects.toThrow();
  });

  it("keeps one key when two first needs race", async () => {
    const database = await openResearchDatabase();
    const [a, b] = await Promise.all([getDataKey(database), getDataKey(database)]);
    const iv = new Uint8Array(12);

    expect(await database.count(KEY_STORE)).toBe(1);
    await expect(
      crypto.subtle.decrypt({ name: "AES-GCM", iv }, b.key, await encryptWith(a.key, iv)),
    ).resolves.toBeDefined();
  });
});
