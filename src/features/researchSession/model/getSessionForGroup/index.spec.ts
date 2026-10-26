import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import {
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredSession,
} from "@/shared/storage";

import { getSessionForGroup } from ".";

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(SESSION_STORE);
  await database.clear(NODE_STORE);
});

const session = (overrides: Partial<StoredSession>): StoredSession => ({
  id: "session-1",
  title: "E-bike motors",
  groupId: 42,
  formerGroupIds: [],
  status: "active",
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

describe("getSessionForGroup", () => {
  it("finds the session that follows the group among several", async () => {
    await database.put(SESSION_STORE, session({ id: "a", groupId: 1 }));
    await database.put(SESSION_STORE, session({ id: "b", groupId: 2 }));

    expect((await getSessionForGroup(database, 2))?.id).toBe("b");
  });

  it("finds a closed session whose group may come back", async () => {
    await database.put(SESSION_STORE, session({ id: "a", groupId: 1, status: "closed" }));

    expect((await getSessionForGroup(database, 1))?.id).toBe("a");
  });

  it("finds the session by a group it followed before", async () => {
    await database.put(SESSION_STORE, session({ id: "a", groupId: 9, formerGroupIds: [1] }));
    await database.put(SESSION_STORE, session({ id: "b", groupId: 2 }));

    expect((await getSessionForGroup(database, 1))?.id).toBe("a");
  });

  it("returns undefined for a group in no live session", async () => {
    await database.put(SESSION_STORE, session({ id: "a", groupId: 1, status: "saved" }));

    expect(await getSessionForGroup(database, 1)).toBeUndefined();
    expect(await getSessionForGroup(database, 5)).toBeUndefined();
  });
});
