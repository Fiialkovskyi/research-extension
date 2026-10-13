import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { readSpaceUsage } from ".";
import { openResearchDatabase, SESSION_STORE, SPACE_STORE, VECTOR_STORE } from "@/shared/storage";

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all([
    database.clear(SESSION_STORE),
    database.clear(SPACE_STORE),
    database.clear(VECTOR_STORE),
  ]);
  await database.put(SPACE_STORE, {
    id: "old",
    model: { repository: "minilm", revision: "a" },
    dims: 384,
    createdAt: 1,
    retiredAt: 50,
  } as never);
  await database.put(SPACE_STORE, {
    id: "new",
    model: { repository: "nomic", revision: "b" },
    dims: 768,
    createdAt: 2,
  } as never);
  await database.put(SESSION_STORE, { id: "s", activeEmbeddingSpaceId: "new" } as never);

  for (const [spaceId, chunkId] of [
    ["old", "c1"],
    ["old", "c2"],
    ["new", "c1"],
  ] as const) {
    await database.put(VECTOR_STORE, { spaceId, chunkId, part: 0, sessionId: "s" } as never);
  }
});

describe("readSpaceUsage", () => {
  it("lists each space with its vectors, size and state, newest first", async () => {
    expect(await readSpaceUsage(await openResearchDatabase())).toEqual([
      {
        id: "new",
        repository: "nomic",
        revision: "b",
        vectorCount: 1,
        approximateBytes: 768 * 4,
        inUse: true,
        retiredAt: null,
        removedAt: null,
      },
      {
        id: "old",
        repository: "minilm",
        revision: "a",
        vectorCount: 2,
        approximateBytes: 2 * 384 * 4,
        inUse: false,
        retiredAt: 50,
        removedAt: null,
      },
    ]);
  });
});
