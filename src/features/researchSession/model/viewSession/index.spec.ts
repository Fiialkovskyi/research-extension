import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { viewSession } from ".";
import {
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredSession,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(SESSION_STORE);
});

const session = (overrides: Partial<StoredSession>): StoredSession => ({
  id: "a",
  title: "E-bike motors",
  groupId: 1,
  formerGroupIds: [],
  status: "active",
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

describe("viewSession", () => {
  it("marks the session viewed and changes nothing else", async () => {
    await database.put(SESSION_STORE, session({}));
    await database.put(SESSION_STORE, session({ id: "b", groupId: 2 }));

    const viewed = await viewSession(database, "b", 50);

    expect(viewed).toMatchObject({ id: "b", viewedAt: 50, status: "active" });
    expect(await database.get(SESSION_STORE, "a")).toEqual(session({}));
  });

  it("refuses a session that is not active", async () => {
    await database.put(SESSION_STORE, session({ status: "saved" }));

    expect(await viewSession(database, "a", 50)).toBeUndefined();
    expect(await viewSession(database, "missing", 50)).toBeUndefined();
    expect((await database.get(SESSION_STORE, "a"))?.viewedAt).toBeUndefined();
  });
});
