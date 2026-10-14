import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { saveBlockedSites } from ".";
import { readBlockedSites } from "../readBlockedSites";
import { BLOCKED_SITES_STORE, openResearchDatabase } from "@/shared/storage";

beforeEach(async () => {
  await (await openResearchDatabase()).clear(BLOCKED_SITES_STORE);
});

describe("saveBlockedSites", () => {
  it("stores the sites encrypted, sorted and once each", async () => {
    const database = await openResearchDatabase();

    expect(await saveBlockedSites(database, ["b.example", "a.example", "b.example"])).toEqual([
      "a.example",
      "b.example",
    ]);

    const stored = await database.get(BLOCKED_SITES_STORE, "user");

    expect(new TextDecoder().decode(new Uint8Array(stored!.encryptedSites))).not.toContain(
      "a.example",
    );
    expect(await readBlockedSites(database)).toEqual(["a.example", "b.example"]);
  });

  it("deletes the record for an empty list", async () => {
    const database = await openResearchDatabase();

    await saveBlockedSites(database, ["a.example"]);
    await saveBlockedSites(database, []);

    expect(await database.count(BLOCKED_SITES_STORE)).toBe(0);
    expect(await readBlockedSites(database)).toEqual([]);
  });
});
