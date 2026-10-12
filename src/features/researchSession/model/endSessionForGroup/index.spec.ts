import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { endSessionForGroup } from ".";
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

const active: StoredSession = {
  id: "session-1",
  title: "E-bike motors",
  groupId: 42,
  status: "active",
  createdAt: 1,
  updatedAt: 1,
};

describe("endSessionForGroup", () => {
  it("keeps the session as saved when its group is gone", async () => {
    await database.put(SESSION_STORE, active);

    const ended = await endSessionForGroup(database, 42);

    expect(ended).toMatchObject({ id: "session-1", status: "saved" });
    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({ status: "saved" });
    expect(ended?.updatedAt).toBeGreaterThan(1);
  });

  it("ignores a group that is not the session's", async () => {
    await database.put(SESSION_STORE, active);

    expect(await endSessionForGroup(database, 7)).toBeUndefined();
    expect(await database.get(SESSION_STORE, "session-1")).toEqual(active);
  });

  it("does nothing when no session is active", async () => {
    expect(await endSessionForGroup(database, 42)).toBeUndefined();
    expect(await database.count(SESSION_STORE)).toBe(0);
  });
});
