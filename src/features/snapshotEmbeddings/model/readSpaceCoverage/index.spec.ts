import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { readSpaceCoverage } from ".";
import { CHUNK_STORE, openResearchDatabase, VECTOR_STORE } from "@/shared/storage";

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all([database.clear(CHUNK_STORE), database.clear(VECTOR_STORE)]);

  for (const id of ["s1:0", "s1:1", "s1:2"]) {
    await database.put(CHUNK_STORE, { id, snapshotId: "s1", sessionId: "s" } as never);
    await database.put(VECTOR_STORE, {
      spaceId: "old",
      chunkId: id,
      part: 0,
      sessionId: "s",
    } as never);
  }

  await database.put(VECTOR_STORE, {
    spaceId: "new",
    chunkId: "s1:0",
    part: 0,
    sessionId: "s",
  } as never);
  await database.put(VECTOR_STORE, {
    spaceId: "new",
    chunkId: "s1:1",
    part: 1,
    sessionId: "s",
  } as never);
});

describe("readSpaceCoverage", () => {
  it("counts the session's chunks with a vector in the space, any part", async () => {
    const database = await openResearchDatabase();

    expect(await readSpaceCoverage(database, "s", "old")).toEqual({ covered: 3, total: 3 });
    expect(await readSpaceCoverage(database, "s", "new")).toEqual({ covered: 2, total: 3 });
  });

  it("covers nothing of a session without chunks", async () => {
    expect(await readSpaceCoverage(await openResearchDatabase(), "empty", "new")).toEqual({
      covered: 0,
      total: 0,
    });
  });
});
