import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { readClusterFactIds } from ".";
import { FACT_STORE, openResearchDatabase } from "@/shared/storage";

beforeEach(async () => {
  const database = await openResearchDatabase();

  await database.clear(FACT_STORE);
  await Promise.all(
    [
      ["a:0:0", "a"],
      ["a:0:1", "a"],
      ["b:0:0", "b"],
      ["c:0:0", "c"],
    ].map(([id, nodeId]) => database.put(FACT_STORE, { id, nodeId, sessionId: "s" } as never)),
  );
});

describe("readClusterFactIds", () => {
  it("reads the facts of the cluster's pages only", async () => {
    expect(
      (
        await readClusterFactIds(await openResearchDatabase(), { memberIds: ["a", "b"] }, "s")
      ).toSorted(),
    ).toEqual(["a:0:0", "a:0:1", "b:0:0"]);
  });
});
