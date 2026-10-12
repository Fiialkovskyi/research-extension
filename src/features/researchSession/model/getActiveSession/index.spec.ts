import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { getActiveSession } from ".";
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
  id: "session-1",
  title: "E-bike motors",
  groupId: 42,
  formerGroupIds: [],
  status: "active",
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

describe("getActiveSession", () => {
  it("returns undefined when nothing was ever started", async () => {
    expect(await getActiveSession(database)).toBeUndefined();
  });

  it("ignores saved sessions", async () => {
    await database.put(SESSION_STORE, session({ status: "saved" }));

    expect(await getActiveSession(database)).toBeUndefined();
  });

  it("returns the active session among saved ones", async () => {
    await database.put(SESSION_STORE, session({ id: "old", status: "saved" }));
    await database.put(SESSION_STORE, session({ id: "current", title: "Batteries" }));

    expect(await getActiveSession(database)).toMatchObject({ id: "current", title: "Batteries" });
  });
});
