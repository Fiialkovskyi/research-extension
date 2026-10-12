import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { rekeySession } from ".";
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

describe("rekeySession", () => {
  it("follows the new group, remembers the old one and becomes active", async () => {
    await database.put(SESSION_STORE, closed);

    expect(await rekeySession(database, "session-1", 51)).toMatchObject({
      groupId: 51,
      formerGroupIds: [42],
      status: "active",
    });
  });

  it("moving back to a former group takes it off the former list", async () => {
    await database.put(SESSION_STORE, { ...closed, groupId: 51, formerGroupIds: [42] });

    expect(await rekeySession(database, "session-1", 42)).toMatchObject({
      groupId: 42,
      formerGroupIds: [51],
    });
  });

  it("does not record the current group as a former one", async () => {
    await database.put(SESSION_STORE, closed);

    expect(await rekeySession(database, "session-1", 42)).toMatchObject({
      groupId: 42,
      formerGroupIds: [],
      status: "active",
    });
  });

  it("leaves an ended session alone", async () => {
    await database.put(SESSION_STORE, { ...closed, status: "saved" });

    expect(await rekeySession(database, "session-1", 51)).toBeUndefined();
    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({ groupId: 42 });
  });
});
