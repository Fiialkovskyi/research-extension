import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { suggestReattach } from ".";
import { openResearchDatabase, SESSION_STORE, type StoredSession } from "@/shared/storage";

const SESSION: StoredSession = {
  id: "new",
  title: "Mid-drive",
  groupId: 9,
  formerGroupIds: [],
  status: "active",
  createdAt: 1,
  updatedAt: 1,
};

const SUGGESTION = { sessionId: "old", title: "E-bike motors" };

beforeEach(async () => {
  const database = await openResearchDatabase();

  await database.clear(SESSION_STORE);
});

describe("suggestReattach", () => {
  it("records the offer on the active session", async () => {
    const database = await openResearchDatabase();

    await database.put(SESSION_STORE, SESSION);

    expect(await suggestReattach(database, "new", SUGGESTION)).toBe(true);
    expect((await database.get(SESSION_STORE, "new"))?.reattachSuggestion).toEqual(SUGGESTION);
  });

  it("makes the offer once, and never after it was declined", async () => {
    const database = await openResearchDatabase();

    await database.put(SESSION_STORE, { ...SESSION, reattachDeclined: true });

    expect(await suggestReattach(database, "new", SUGGESTION)).toBe(false);

    await database.put(SESSION_STORE, { ...SESSION, reattachSuggestion: SUGGESTION });

    expect(await suggestReattach(database, "new", { sessionId: "x", title: "X" })).toBe(false);
  });
});
