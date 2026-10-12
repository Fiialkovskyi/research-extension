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

    const recentSwitches = [{ from: "node-0", to: "node-1", at: 900 }];

    expect(await setSessionFocus(database, "session-1", { focus: VISIT, recentSwitches })).toBe(
      true,
    );
    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({
      focus: VISIT,
      recentSwitches,
    });
  });

  it("forgets where the user left off when asked, and keeps it otherwise", async () => {
    const lastPosition = { nodeId: "node-0", title: "B", readFraction: 0.4 };

    await database.put(SESSION_STORE, { ...buildSession("active"), lastPosition });
    await setSessionFocus(database, "session-1", { focus: VISIT, recentSwitches: [] });

    expect((await database.get(SESSION_STORE, "session-1"))?.lastPosition).toEqual(lastPosition);

    await setSessionFocus(database, "session-1", {
      focus: VISIT,
      recentSwitches: [],
      clearLastPosition: true,
    });

    expect((await database.get(SESSION_STORE, "session-1"))?.lastPosition).toBeUndefined();
  });

  it("leaves a session that is no longer active as it was", async () => {
    await database.put(SESSION_STORE, buildSession("closed"));

    expect(await setSessionFocus(database, "session-1", { focus: VISIT, recentSwitches: [] })).toBe(
      false,
    );
    expect((await database.get(SESSION_STORE, "session-1"))?.focus).toBeUndefined();
  });

  it("writes nothing for a session that does not exist", async () => {
    expect(await setSessionFocus(database, "session-1", { focus: VISIT, recentSwitches: [] })).toBe(
      false,
    );
    expect(await database.count(SESSION_STORE)).toBe(0);
  });
});
