import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { readRejectedKeys } from ".";
import { openResearchDatabase, REJECTION_STORE } from "@/shared/storage";

beforeEach(async () => {
  const database = await openResearchDatabase();

  await database.clear(REJECTION_STORE);
  await database.put(REJECTION_STORE, { id: "s:k1", sessionId: "s", key: "k1", createdAt: 1 });
  await database.put(REJECTION_STORE, { id: "t:k2", sessionId: "t", key: "k2", createdAt: 1 });
});

describe("readRejectedKeys", () => {
  it("reads the keys of one session's rejections", async () => {
    expect(await readRejectedKeys(await openResearchDatabase(), "s")).toEqual(new Set(["k1"]));
  });
});
