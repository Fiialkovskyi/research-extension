import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { saveActiveSession } from ".";
import {
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredNode,
  type StoredSession,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

const SESSION: StoredSession = {
  id: "session-1",
  title: "E-bike motors",
  groupId: 42,
  formerGroupIds: [],
  status: "active",
  createdAt: 1,
  updatedAt: 1,
};

const node = (id: string, tabId: number, overrides: Partial<StoredNode> = {}): StoredNode => ({
  id,
  sessionId: "session-1",
  tabId,
  kind: "page",
  url: `https://example.org/${id}`,
  domain: "example.org",
  title: `Page ${id}`,
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  signals: {
    activeDwellMs: 0,
    maxScroll: 0.4,
    copyEvents: 0,
    focusCount: 1,
    revisitCount: 0,
    quickReturnCount: 0,
  },
  tabState: "open",
  createdAt: 1,
  ...overrides,
});

/** The group's tabs in tab-strip order: C, A, then a new-tab page with no node. */
const queryGroupTabs = () =>
  Promise.resolve([
    { id: 9, incognito: false, windowId: 1 },
    { id: 7, incognito: false, windowId: 1 },
    { id: 11, incognito: false, windowId: 1 },
  ]);

beforeEach(async () => {
  database = await openResearchDatabase();
  await Promise.all([database.clear(SESSION_STORE), database.clear(NODE_STORE)]);
  await database.put(SESSION_STORE, SESSION);
  await database.put(NODE_STORE, node("a", 7, { lastFocusedAt: 50 }));
  await database.put(NODE_STORE, node("c", 9, { lastFocusedAt: 80 }));
  await database.put(NODE_STORE, node("old", 7, { tabState: "closed", lastFocusedAt: 99 }));
});

describe("saveActiveSession", () => {
  it("keeps the tabs in order with their pages, and marks the session saved", async () => {
    const saved = await saveActiveSession({ database, queryGroupTabs, now: 500 });

    expect(saved?.session).toMatchObject({
      status: "saved",
      savedAt: 500,
      savedTabs: [
        { nodeId: "c", url: "https://example.org/c", title: "Page c" },
        { nodeId: "a", url: "https://example.org/a", title: "Page a" },
      ],
    });
    expect(saved?.tabs.map(({ id }) => id)).toEqual([9, 7, 11]);
    expect((await database.get(SESSION_STORE, "session-1"))?.status).toBe("saved");
  });

  it("closes the session's pages", async () => {
    await saveActiveSession({ database, queryGroupTabs, now: 500 });

    expect((await database.getAll(NODE_STORE)).every(({ tabState }) => tabState === "closed")).toBe(
      true,
    );
  });

  it("keeps where the user left off: the page in focus", async () => {
    await database.put(SESSION_STORE, {
      ...SESSION,
      focus: {
        nodeId: "a",
        since: null,
        visitDwellMs: 0,
        isRevisit: false,
        isRevisitCounted: false,
      },
    });

    expect(
      (await saveActiveSession({ database, queryGroupTabs, now: 500 }))?.session.lastPosition,
    ).toEqual({ nodeId: "a", title: "Page a", readFraction: 0.4 });
  });

  it("falls back to the page focused last", async () => {
    expect(
      (await saveActiveSession({ database, queryGroupTabs, now: 500 }))?.session.lastPosition
        ?.nodeId,
    ).toBe("old");
  });

  it("does nothing without an active session", async () => {
    await database.put(SESSION_STORE, { ...SESSION, status: "closed" });

    expect(await saveActiveSession({ database, queryGroupTabs, now: 500 })).toBeUndefined();
  });
});
