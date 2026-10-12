import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { readSignalTarget } from ".";
import {
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredNode,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

const buildNode = (id: string, overrides: Partial<StoredNode> = {}): StoredNode => ({
  id,
  sessionId: "session-1",
  tabId: 7,
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
    focusCount: 1,
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
  // Tab 7 showed A, then moved on to B.
  await database.put(NODE_STORE, buildNode("a", { tabState: "closed" }));
  await database.put(NODE_STORE, buildNode("b", { parentNodeId: "a", createdAt: 2 }));
});

describe("readSignalTarget", () => {
  it("finds the tab's current node, ignoring a fragment", async () => {
    expect(
      await readSignalTarget(database, { tabId: 7, url: "https://example.org/b#specs" }),
    ).toEqual({ node: expect.objectContaining({ id: "b" }), isCurrent: true });
  });

  it("finds the page just left, whose last batch lost the race with the next commit", async () => {
    expect(await readSignalTarget(database, { tabId: 7, url: "https://example.org/a" })).toEqual({
      node: expect.objectContaining({ id: "a" }),
      isCurrent: false,
    });
  });

  it("drops a batch from a page the tab has moved past, without stopping it", async () => {
    expect(await readSignalTarget(database, { tabId: 7, url: "https://example.org/z" })).toEqual({
      node: undefined,
      stop: false,
    });
  });

  it("stops a page whose tab is not a session tab", async () => {
    expect(await readSignalTarget(database, { tabId: 99, url: "https://example.org/b" })).toEqual({
      node: undefined,
      stop: true,
    });
  });

  it("stops every page when no session is active", async () => {
    await database.clear(SESSION_STORE);

    expect(await readSignalTarget(database, { tabId: 7, url: "https://example.org/b" })).toEqual({
      node: undefined,
      stop: true,
    });
  });
});
