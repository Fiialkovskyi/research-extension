import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { recordSessionTabs } from ".";
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
    pasteEvents: 0,
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

const SAVED_TABS = [
  { nodeId: "c", url: "https://example.org/c", title: "Page c" },
  { nodeId: "a", url: "https://example.org/a", title: "Page a" },
];

beforeEach(async () => {
  database = await openResearchDatabase();
  await Promise.all([database.clear(SESSION_STORE), database.clear(NODE_STORE)]);
  await database.put(SESSION_STORE, SESSION);
  await database.put(NODE_STORE, node("a", 7));
  await database.put(NODE_STORE, node("c", 9));
  await database.put(NODE_STORE, node("old", 7, { tabState: "closed" }));
});

/** Each group's own tab, by group id. */
const queryTabs = (groupId: number) =>
  Promise.resolve(
    groupId === 43
      ? [{ id: 20, incognito: false, windowId: 1 }]
      : [{ id: 7, incognito: false, windowId: 1 }],
  );

describe("recordSessionTabs", () => {
  it("keeps the group's tabs in order with the page each shows", async () => {
    expect(await recordSessionTabs({ database, queryGroupTabs })).toBe(true);
    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({
      status: "active",
      savedTabs: SAVED_TABS,
    });
  });

  it("writes nothing when the tabs are already on record", async () => {
    await database.put(SESSION_STORE, { ...SESSION, savedTabs: SAVED_TABS });

    expect(await recordSessionTabs({ database, queryGroupTabs })).toBe(false);
  });

  it("keeps the tabs on record when the group has emptied", async () => {
    await database.put(SESSION_STORE, { ...SESSION, savedTabs: SAVED_TABS });

    expect(await recordSessionTabs({ database, queryGroupTabs: () => Promise.resolve([]) })).toBe(
      false,
    );
    expect((await database.get(SESSION_STORE, "session-1"))?.savedTabs).toEqual(SAVED_TABS);
  });

  it("does nothing without an active session", async () => {
    await database.put(SESSION_STORE, { ...SESSION, status: "closed" });

    expect(await recordSessionTabs({ database, queryGroupTabs })).toBe(false);
    expect((await database.get(SESSION_STORE, "session-1"))?.savedTabs).toBeUndefined();
  });

  it("saves each active session's own tabs", async () => {
    await database.put(SESSION_STORE, { ...SESSION, id: "session-2", groupId: 43 });
    await database.put(NODE_STORE, node("x", 20, { sessionId: "session-2" }));
    expect(await recordSessionTabs({ database, queryGroupTabs: queryTabs })).toBe(true);

    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({
      savedTabs: [{ nodeId: "a", url: "https://example.org/a", title: "Page a" }],
    });
    expect(await database.get(SESSION_STORE, "session-2")).toMatchObject({
      savedTabs: [{ nodeId: "x", url: "https://example.org/x", title: "Page x" }],
    });
  });
});
