import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { readPageVectors } from ".";
import { openResearchDatabase, VECTOR_STORE } from "@/shared/storage";

const vector = (
  spaceId: string,
  chunkId: string,
  part: number,
  nodeId: string,
  sessionId: string,
  values: number[],
) => ({ spaceId, chunkId, part, nodeId, sessionId, vector: new Float32Array(values) });

beforeEach(async () => {
  const database = await openResearchDatabase();

  await database.clear(VECTOR_STORE);
  await Promise.all(
    [
      vector("space-1", "s:0", 0, "a", "session-1", [1, 0]),
      vector("space-1", "s:0", 1, "a", "session-1", [0, 1]),
      vector("space-1", "t:0", 0, "b", "session-1", [3, 0]),
      vector("space-1", "u:0", 0, "c", "session-2", [1, 0]),
      vector("space-2", "s:0", 0, "a", "session-1", [0, 5]),
    ].map((record) => database.put(VECTOR_STORE, record)),
  );
});

describe("readPageVectors", () => {
  it("averages a page's vectors and scales the mean to unit length", async () => {
    const vectors = await readPageVectors(await openResearchDatabase(), "session-1", "space-1");

    const [x, y] = vectors.get("a") ?? [];

    expect(x).toBeCloseTo(Math.SQRT1_2);
    expect(y).toBeCloseTo(Math.SQRT1_2);
    expect([...(vectors.get("b") ?? [])]).toEqual([1, 0]);
  });

  it("keeps only the session's vectors in the one space asked for", async () => {
    const vectors = await readPageVectors(await openResearchDatabase(), "session-1", "space-1");

    expect([...vectors.keys()].toSorted()).toEqual(["a", "b"]);
  });
});
