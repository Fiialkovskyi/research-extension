import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { injectSessionTabs } from ".";
import {
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredNode,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

const buildNode = (id: string, tabId: number, overrides: Partial<StoredNode> = {}): StoredNode => ({
  id,
  sessionId: "session-1",
  tabId,
  kind: "page",
  url: `https://example.org/${id}`,
  domain: "example.org",
  title: id,
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  signals: {
    activeDwellMs: 0,
    maxScroll: 0,
    copyEvents: 0,
    focusCount: 0,
    revisitCount: 0,
    quickReturnCount: 0,
  },
  tabState: "open",
  createdAt: 1,
  ...overrides,
});

beforeEach(async () => {
  database = await openResearchDatabase();
  await Promise.all([database.clear(SESSION_STORE), database.clear(NODE_STORE)]);
  await database.put(SESSION_STORE, {
    id: "session-1",
    title: "E-bike motors",
    groupId: 42,
    formerGroupIds: [],
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  });
  await database.put(NODE_STORE, buildNode("a", 7, { tabState: "closed" }));
  await database.put(NODE_STORE, buildNode("b", 7));
  await database.put(NODE_STORE, buildNode("c", 8));
  await database.put(NODE_STORE, buildNode("d", 9, { tabState: "closed" }));
  await database.put(NODE_STORE, buildNode("other", 10, { sessionId: "session-0" }));
});

describe("injectSessionTabs", () => {
  it("injects into each open session tab once, and nowhere else", async () => {
    const executeScript = vi.fn(() => Promise.resolve([]));

    expect((await injectSessionTabs(database, { executeScript })).toSorted()).toEqual([7, 8]);
    expect(executeScript).toHaveBeenCalledTimes(2);
  });

  it("reports only the tabs that accepted the observer", async () => {
    const executeScript = vi.fn(({ target }: { target: { tabId: number } }) =>
      target.tabId === 7 ? Promise.reject(new Error("Restricted page")) : Promise.resolve([]),
    );

    expect(await injectSessionTabs(database, { executeScript })).toEqual([8]);
  });

  it("injects nothing without an active session", async () => {
    await database.clear(SESSION_STORE);

    const executeScript = vi.fn(() => Promise.resolve([]));

    expect(await injectSessionTabs(database, { executeScript })).toEqual([]);
    expect(executeScript).not.toHaveBeenCalled();
  });
});
