import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { setSessionFocus } from ".";
import {
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredSession,
} from "@/shared/storage";

const VISIT = {
  nodeId: "node-1",
  since: 1_000,
  visitDwellMs: 0,
  isRevisit: false,
  isRevisitCounted: false,
};

const buildSession = (status: StoredSession["status"]): StoredSession => ({
  id: "session-1",
  title: "E-bike motors",
  groupId: 42,
  formerGroupIds: [],
  status,
  createdAt: 1,
  updatedAt: 1,
});

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(SESSION_STORE);
});

describe("setSessionFocus", () => {
  it("records the visit on the active session", async () => {
    await database.put(SESSION_STORE, buildSession("active"));

    expect(await setSessionFocus(database, "session-1", VISIT)).toBe(true);
    expect((await database.get(SESSION_STORE, "session-1"))?.focus).toEqual(VISIT);
  });

  it("leaves a session that is no longer active as it was", async () => {
    await database.put(SESSION_STORE, buildSession("closed"));

    expect(await setSessionFocus(database, "session-1", VISIT)).toBe(false);
    expect((await database.get(SESSION_STORE, "session-1"))?.focus).toBeUndefined();
  });

  it("writes nothing for a session that does not exist", async () => {
    expect(await setSessionFocus(database, "session-1", VISIT)).toBe(false);
    expect(await database.count(SESSION_STORE)).toBe(0);
  });
});
