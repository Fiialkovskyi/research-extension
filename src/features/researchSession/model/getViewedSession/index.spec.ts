import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { getViewedSession } from ".";
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
  groupId: 1,
  formerGroupIds: [],
  status: "active",
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

describe("getViewedSession", () => {
  it("is none when no session is active", async () => {
    await database.put(SESSION_STORE, session({ status: "saved", viewedAt: 9 }));

    expect(await getViewedSession(database)).toBeUndefined();
  });

  it("is the session chosen last", async () => {
    await database.put(SESSION_STORE, session({ id: "a", groupId: 1, viewedAt: 5 }));
    await database.put(SESSION_STORE, session({ id: "b", groupId: 2, viewedAt: 8 }));

    expect((await getViewedSession(database, 1))?.id).toBe("b");
  });

  it("is the session of the selected tab's group when nothing was chosen", async () => {
    await database.put(SESSION_STORE, session({ id: "a", groupId: 1, updatedAt: 9 }));
    await database.put(SESSION_STORE, session({ id: "b", groupId: 2 }));

    expect((await getViewedSession(database, 2))?.id).toBe("b");
  });

  it("is the most recently recorded session when the selected tab is in none", async () => {
    await database.put(SESSION_STORE, session({ id: "a", groupId: 1, updatedAt: 3 }));
    await database.put(SESSION_STORE, session({ id: "b", groupId: 2, updatedAt: 7 }));

    expect((await getViewedSession(database, 99))?.id).toBe("b");
    expect((await getViewedSession(database))?.id).toBe("b");
  });

  it("passes over a chosen session that has since closed", async () => {
    await database.put(
      SESSION_STORE,
      session({ id: "a", groupId: 1, viewedAt: 9, status: "closed" }),
    );
    await database.put(SESSION_STORE, session({ id: "b", groupId: 2 }));

    expect((await getViewedSession(database))?.id).toBe("b");
  });
});
