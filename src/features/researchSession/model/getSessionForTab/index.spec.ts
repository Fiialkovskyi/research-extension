import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { getSessionForTab } from ".";
import {
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredNode,
  type StoredSession,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(SESSION_STORE);
  await database.clear(NODE_STORE);
});

const session = (overrides: Partial<StoredSession>): StoredSession => ({
  id: "session-1",
  title: "E-bike motors",
  groupId: 42,
  formerGroupIds: [],
  status: "active",
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const node = (overrides: Partial<StoredNode>): StoredNode => ({
  id: "node-1",
  sessionId: "session-1",
  tabId: 7,
  kind: "page",
  url: "https://example.com/",
  domain: "example.com",
  title: "Example",
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  signals: {
    activeDwellMs: 0,
    maxScroll: 0,
    copyEvents: 0,
    pasteEvents: 0,
    focusCount: 0,
    revisitCount: 0,
    quickReturnCount: 0,
  },
  tabState: "open",
  createdAt: 1,
  ...overrides,
});

describe("getSessionForTab", () => {
  it("resolves a tab through its group when two sessions are live", async () => {
    await database.put(SESSION_STORE, session({ id: "a", groupId: 1 }));
    await database.put(SESSION_STORE, session({ id: "b", groupId: 2 }));

    expect((await getSessionForTab(database, { tabId: 7, groupId: 2 }))?.id).toBe("b");
  });

  it("resolves a tab by a former group id", async () => {
    await database.put(SESSION_STORE, session({ id: "a", groupId: 9, formerGroupIds: [1] }));

    expect((await getSessionForTab(database, { tabId: 7, groupId: 1 }))?.id).toBe("a");
  });

  it("resolves a tab that left every group by the session holding its open page", async () => {
    await database.put(SESSION_STORE, session({ id: "a", groupId: 1 }));
    await database.put(SESSION_STORE, session({ id: "b", groupId: 2 }));
    await database.put(NODE_STORE, node({ sessionId: "b", tabId: 7 }));

    expect((await getSessionForTab(database, { tabId: 7, groupId: -1 }))?.id).toBe("b");
  });

  it("ignores a closed page when the tab is in no group", async () => {
    await database.put(SESSION_STORE, session({ id: "a", groupId: 1 }));
    await database.put(NODE_STORE, node({ sessionId: "a", tabId: 7, tabState: "closed" }));

    expect(await getSessionForTab(database, { tabId: 7, groupId: -1 })).toBeUndefined();
  });

  it("does not resolve a tab to a closed session", async () => {
    await database.put(SESSION_STORE, session({ id: "a", groupId: 1, status: "closed" }));
    await database.put(NODE_STORE, node({ sessionId: "a", tabId: 7 }));

    expect(await getSessionForTab(database, { tabId: 7, groupId: 1 })).toBeUndefined();
    expect(await getSessionForTab(database, { tabId: 7, groupId: -1 })).toBeUndefined();
  });

  it("returns undefined for a tab in no session", async () => {
    await database.put(SESSION_STORE, session({ id: "a", groupId: 1 }));

    expect(await getSessionForTab(database, { tabId: 8, groupId: 5 })).toBeUndefined();
  });
});
