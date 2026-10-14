import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { readBlockedSites } from ".";
import { BLOCKED_SITES_STORE, openResearchDatabase } from "@/shared/storage";

beforeEach(async () => {
  await (await openResearchDatabase()).clear(BLOCKED_SITES_STORE);
});

describe("readBlockedSites", () => {
  it("reads none when nothing was added", async () => {
    expect(await readBlockedSites(await openResearchDatabase())).toEqual([]);
  });

  it("reads none from a record that cannot be decrypted", async () => {
    const database = await openResearchDatabase();

    await database.put(BLOCKED_SITES_STORE, {
      id: "user",
      keyId: "gone",
      iv: new Uint8Array(12),
      encryptedSites: new ArrayBuffer(32),
    });

    expect(await readBlockedSites(database)).toEqual([]);
  });
});
