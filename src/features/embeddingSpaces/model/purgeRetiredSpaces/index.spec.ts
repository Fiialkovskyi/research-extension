import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { purgeRetiredSpaces } from ".";
import { openResearchDatabase, SESSION_STORE, SPACE_STORE, VECTOR_STORE } from "@/shared/storage";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 100 * DAY;

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all([
    database.clear(SESSION_STORE),
    database.clear(SPACE_STORE),
    database.clear(VECTOR_STORE),
  ]);
  await database.put(SPACE_STORE, { id: "long-gone", retiredAt: NOW - 15 * DAY } as never);
  await database.put(SPACE_STORE, { id: "recent", retiredAt: NOW - 13 * DAY } as never);
  await database.put(SPACE_STORE, { id: "active" } as never);
});

describe("purgeRetiredSpaces", () => {
  it("removes spaces retired more than 14 days ago, and only those", async () => {
    const database = await openResearchDatabase();

    expect(await purgeRetiredSpaces(database, NOW)).toEqual(["long-gone"]);
    expect(await purgeRetiredSpaces(database, NOW)).toEqual([]);
    expect((await database.get(SPACE_STORE, "recent"))?.removedAt).toBeUndefined();
  });
});
