import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { reopenSessionForGroup } from ".";
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

const closed: StoredSession = {
  id: "session-1",
  title: "E-bike motors",
  groupId: 42,
  formerGroupIds: [],
  status: "closed",
  createdAt: 1,
  updatedAt: 1,
};

describe("reopenSessionForGroup", () => {
  it("reactivates the closed session when its group comes back", async () => {
    await database.put(SESSION_STORE, closed);

    expect(await reopenSessionForGroup(database, 42)).toMatchObject({ status: "active" });
    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({ status: "active" });
  });

  it("ignores a group that is not the closed session's", async () => {
    await database.put(SESSION_STORE, closed);

    expect(await reopenSessionForGroup(database, 7)).toBeUndefined();
    expect(await database.get(SESSION_STORE, "session-1")).toEqual(closed);
  });

  it("leaves an ended session ended", async () => {
    await database.put(SESSION_STORE, { ...closed, status: "saved" });

    expect(await reopenSessionForGroup(database, 42)).toBeUndefined();
  });
});
