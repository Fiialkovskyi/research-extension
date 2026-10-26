import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { listSavedSessions } from ".";
import {
  NODE_STORE,
  openResearchDatabase,
  SESSION_STORE,
  type StoredSession,
} from "@/shared/storage";

const session = (id: string, overrides: Partial<StoredSession>): StoredSession => ({
  id,
  title: id,
  groupId: 1,
  formerGroupIds: [],
  status: "saved",
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all([database.clear(SESSION_STORE), database.clear(NODE_STORE)]);
  await database.put(SESSION_STORE, session("batteries", { savedAt: 100 }));
  await database.put(
    SESSION_STORE,
    session("motors", {
      savedAt: 200,
      lastPosition: { nodeId: "b", title: "Page B", readFraction: 0.4 },
    }),
  );
  await database.put(SESSION_STORE, session("ended", { updatedAt: 50 }));
  await database.put(SESSION_STORE, session("live", { status: "active" }));
  await database.put(SESSION_STORE, session("away", { status: "closed", savedAt: 300 }));
  await database.put(NODE_STORE, { id: "n1", sessionId: "motors" } as never);
  await database.put(NODE_STORE, { id: "n2", sessionId: "motors" } as never);
});

describe("listSavedSessions", () => {
  it("lists saved and closed sessions newest first, with page counts and where they were left off", async () => {
    expect(await listSavedSessions(await openResearchDatabase())).toEqual([
      { id: "away", title: "away", savedAt: 300, pageCount: 0, lastPosition: null },
      {
        id: "motors",
        title: "motors",
        savedAt: 200,
        pageCount: 2,
        lastPosition: { title: "Page B", readFraction: 0.4 },
      },
      { id: "batteries", title: "batteries", savedAt: 100, pageCount: 0, lastPosition: null },
      { id: "ended", title: "ended", savedAt: 50, pageCount: 0, lastPosition: null },
    ]);
  });
});
