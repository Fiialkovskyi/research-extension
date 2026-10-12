import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { claimSessionEmbeddingSpace } from ".";
import { openResearchDatabase, SESSION_STORE } from "@/shared/storage";

beforeEach(async () => {
  const database = await openResearchDatabase();

  await database.clear(SESSION_STORE);
  await database.put(SESSION_STORE, {
    id: "session-1",
    title: "E-bike motors",
    groupId: 42,
    formerGroupIds: [],
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  });
});

describe("claimSessionEmbeddingSpace", () => {
  it("gives a session without a space the first one offered, and keeps it", async () => {
    const database = await openResearchDatabase();

    expect(await claimSessionEmbeddingSpace(database, "session-1", "space-a")).toBe("space-a");
    expect(await claimSessionEmbeddingSpace(database, "session-1", "space-b")).toBe("space-a");
    expect((await database.get(SESSION_STORE, "session-1"))?.activeEmbeddingSpaceId).toBe(
      "space-a",
    );
  });

  it("does nothing for a session that does not exist", async () => {
    const database = await openResearchDatabase();

    expect(await claimSessionEmbeddingSpace(database, "missing", "space-a")).toBeUndefined();
  });
});
