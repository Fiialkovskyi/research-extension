import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { closeSessionForGroup } from ".";
import {
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredSession,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await Promise.all([database.clear(SESSION_STORE), database.clear(NODE_STORE)]);
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

  it("saves where the user left off: the page focused last", async () => {
    await database.put(SESSION_STORE, active);
    await database.put(NODE_STORE, {
      id: "b",
      sessionId: "session-1",
      tabId: 7,
      kind: "page",
      url: "https://example.org/b",
      domain: "example.org",
      title: "Page B",
      parentNodeId: null,
      openerNodeId: null,
      transitionType: "link",
      signals: {
        activeDwellMs: 0,
        maxScroll: 0.4,
        copyEvents: 0,
        pasteEvents: 0,
        focusCount: 1,
        revisitCount: 0,
        quickReturnCount: 0,
      },
      tabState: "closed",
      createdAt: 1,
      lastFocusedAt: 5,
    });

    expect(await closeSessionForGroup(database, 42)).toMatchObject({
      lastPosition: { nodeId: "b", title: "Page B", readFraction: 0.4 },
      savedAt: expect.any(Number),
    });
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
