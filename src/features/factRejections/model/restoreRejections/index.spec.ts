import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { restoreRejections } from ".";
import { openResearchDatabase, REJECTION_STORE } from "@/shared/storage";

beforeEach(async () => {
  const database = await openResearchDatabase();

  await database.clear(REJECTION_STORE);
  await database.put(REJECTION_STORE, { id: "s:k1", sessionId: "s", key: "k1", createdAt: 1 });
  await database.put(REJECTION_STORE, { id: "t:k2", sessionId: "t", key: "k2", createdAt: 1 });
});

describe("restoreRejections", () => {
  it("removes one session's rejections and leaves another's", async () => {
    const database = await openResearchDatabase();

    expect(await restoreRejections(database, "s")).toBe(1);
    expect((await database.getAll(REJECTION_STORE)).map(({ id }) => id)).toEqual(["t:k2"]);
  });
});
