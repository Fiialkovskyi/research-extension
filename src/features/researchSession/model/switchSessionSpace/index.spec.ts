import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { switchSessionSpace } from ".";
import { openResearchDatabase, SESSION_STORE, SPACE_STORE } from "@/shared/storage";

const session = (id: string, activeEmbeddingSpaceId: string, status = "active") =>
  ({
    id,
    title: id,
    groupId: 1,
    formerGroupIds: [],
    status,
    createdAt: 1,
    updatedAt: 1,
    activeEmbeddingSpaceId,
  }) as never;

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all([database.clear(SESSION_STORE), database.clear(SPACE_STORE)]);
  await database.put(SPACE_STORE, { id: "old" } as never);
  await database.put(SPACE_STORE, { id: "new", retiredAt: 5 } as never);
  await database.put(SESSION_STORE, session("s", "old"));
});

describe("switchSessionSpace", () => {
  it("moves the session, retires the space it left, and revives the new one", async () => {
    const database = await openResearchDatabase();

    expect(await switchSessionSpace(database, "s", "new", 100)).toBe("old");
    expect((await database.get(SESSION_STORE, "s"))?.activeEmbeddingSpaceId).toBe("new");
    expect((await database.get(SPACE_STORE, "old"))?.retiredAt).toBe(100);
    expect(await database.get(SPACE_STORE, "new")).not.toHaveProperty("retiredAt");
  });

  it("does not retire a space another session still uses", async () => {
    const database = await openResearchDatabase();

    await database.put(SESSION_STORE, session("saved", "old", "saved"));
    await switchSessionSpace(database, "s", "new", 100);

    expect(await database.get(SPACE_STORE, "old")).not.toHaveProperty("retiredAt");
  });

  it("does nothing for a session that does not exist", async () => {
    expect(
      await switchSessionSpace(await openResearchDatabase(), "missing", "new"),
    ).toBeUndefined();
  });
});
