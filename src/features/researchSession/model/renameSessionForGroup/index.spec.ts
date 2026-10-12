import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { renameSessionForGroup } from ".";
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

beforeEach(async () => {
  await database.put(SESSION_STORE, active);
});

describe("renameSessionForGroup", () => {
  it("takes over the group's new title", async () => {
    const renamed = await renameSessionForGroup(database, 42, "Mid-drive motors");

    expect(renamed).toMatchObject({ title: "Mid-drive motors" });
    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({
      title: "Mid-drive motors",
    });
  });

  it("ignores another group's rename", async () => {
    expect(await renameSessionForGroup(database, 7, "Elsewhere")).toBeUndefined();
    expect(await database.get(SESSION_STORE, "session-1")).toEqual(active);
  });

  it("writes nothing when the title has not changed", async () => {
    expect(await renameSessionForGroup(database, 42, "E-bike motors")).toBeUndefined();
    expect(await database.get(SESSION_STORE, "session-1")).toEqual(active);
  });

  it("keeps the session's name when the group's title is cleared", async () => {
    expect(await renameSessionForGroup(database, 42, "   ")).toBeUndefined();
    expect(await database.get(SESSION_STORE, "session-1")).toEqual(active);
  });
});
