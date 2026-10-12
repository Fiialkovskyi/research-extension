import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { closeSessionForGroup } from ".";
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
  formerGroupIds: [],
  status: "active",
  createdAt: 1,
  updatedAt: 1,
};

describe("closeSessionForGroup", () => {
  it("closes the active session when its group is removed, keeping the group id", async () => {
    await database.put(SESSION_STORE, active);

    expect(await closeSessionForGroup(database, 42)).toMatchObject({
      status: "closed",
      groupId: 42,
    });
    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({ status: "closed" });
  });

  it("ignores a group that is not the session's", async () => {
    await database.put(SESSION_STORE, active);

    expect(await closeSessionForGroup(database, 7)).toBeUndefined();
    expect(await database.get(SESSION_STORE, "session-1")).toEqual(active);
  });

  it("does nothing when no session is active", async () => {
    expect(await closeSessionForGroup(database, 42)).toBeUndefined();
  });
});
