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

import { listLiveSessions } from ".";

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

describe("listLiveSessions", () => {
  it("returns nothing when no session was started", async () => {
    expect(await listLiveSessions(database)).toEqual([]);
  });

  it("returns every active and closed session and no saved one", async () => {
    await database.put(SESSION_STORE, session({ id: "a", groupId: 1 }));
    await database.put(SESSION_STORE, session({ id: "b", groupId: 2 }));
    await database.put(SESSION_STORE, session({ id: "c", groupId: 3, status: "closed" }));
    await database.put(SESSION_STORE, session({ id: "d", groupId: 4, status: "saved" }));

    const ids = (await listLiveSessions(database)).map(({ id }) => id);

    expect(ids.toSorted()).toEqual(["a", "b", "c"]);
  });
});
