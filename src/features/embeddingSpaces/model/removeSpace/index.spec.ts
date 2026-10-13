import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { removeSpace } from ".";
import { openResearchDatabase, SESSION_STORE, SPACE_STORE, VECTOR_STORE } from "@/shared/storage";

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all([
    database.clear(SESSION_STORE),
    database.clear(SPACE_STORE),
    database.clear(VECTOR_STORE),
  ]);
  await database.put(SPACE_STORE, { id: "old", retiredAt: 1 } as never);
  await database.put(SPACE_STORE, { id: "new" } as never);
  await database.put(SESSION_STORE, { id: "s", activeEmbeddingSpaceId: "new" } as never);
  await database.put(VECTOR_STORE, { spaceId: "old", chunkId: "c", part: 0 } as never);
  await database.put(VECTOR_STORE, { spaceId: "new", chunkId: "c", part: 0 } as never);
});

describe("removeSpace", () => {
  it("deletes a retired space's vectors and marks it removed", async () => {
    const database = await openResearchDatabase();

    expect(await removeSpace(database, "old", 9)).toBe(true);
    expect((await database.getAll(VECTOR_STORE)).map(({ spaceId }) => spaceId)).toEqual(["new"]);
    expect((await database.get(SPACE_STORE, "old"))?.removedAt).toBe(9);
  });

  it("refuses a space a session uses", async () => {
    const database = await openResearchDatabase();

    expect(await removeSpace(database, "new")).toBe(false);
    expect(await database.count(VECTOR_STORE)).toBe(2);
  });
});
