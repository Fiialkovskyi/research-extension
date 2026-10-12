import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { getLiveSession } from ".";
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

const session: StoredSession = {
  id: "session-1",
  title: "E-bike motors",
  groupId: 42,
  formerGroupIds: [],
  status: "active",
  createdAt: 1,
  updatedAt: 1,
};

describe("getLiveSession", () => {
  it("reads the active session", async () => {
    await database.put(SESSION_STORE, session);

    expect(await getLiveSession(database)).toEqual(session);
  });

  it("reads a closed session when none is active", async () => {
    await database.put(SESSION_STORE, { ...session, status: "closed" });

    expect(await getLiveSession(database)).toMatchObject({ status: "closed" });
  });

  it("ignores an ended session", async () => {
    await database.put(SESSION_STORE, { ...session, status: "saved" });

    expect(await getLiveSession(database)).toBeUndefined();
  });
});
