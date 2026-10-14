import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { readSessionRoot } from ".";
import {
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  type StoredNode,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(NODE_STORE);
});

const node = (overrides: Partial<StoredNode>): StoredNode => ({
  id: "node",
  sessionId: "session-1",
  tabId: 7,
  kind: "page",
  url: "https://example.org",
  domain: "example.org",
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

describe("readSessionRoot", () => {
  it("is undefined while the session has searched nothing", async () => {
    await database.put(NODE_STORE, node({ id: "page" }));

    expect(await readSessionRoot(database, "session-1")).toBeUndefined();
  });

  it("is the session's earliest SERP, whatever was recorded before or after it", async () => {
    await database.put(NODE_STORE, node({ id: "page", createdAt: 1 }));
    await database.put(NODE_STORE, node({ id: "later", kind: "serp", query: "b", createdAt: 5 }));
    await database.put(NODE_STORE, node({ id: "first", kind: "serp", query: "a", createdAt: 3 }));

    expect(await readSessionRoot(database, "session-1")).toMatchObject({ id: "first" });
  });

  it("leaves out the node it is asked to exclude", async () => {
    await database.put(NODE_STORE, node({ id: "a", kind: "serp", query: "a", createdAt: 4 }));
    await database.put(NODE_STORE, node({ id: "b", kind: "serp", query: "b", createdAt: 4 }));

    expect(await readSessionRoot(database, "session-1", "a")).toMatchObject({ id: "b" });
  });

  it("ignores another session's searches", async () => {
    await database.put(
      NODE_STORE,
      node({ id: "other", sessionId: "session-2", kind: "serp", query: "a", createdAt: 0 }),
    );
    await database.put(NODE_STORE, node({ id: "own", kind: "serp", query: "b", createdAt: 9 }));

    expect(await readSessionRoot(database, "session-1")).toMatchObject({ id: "own" });
  });

  it("picks the same root among searches recorded in one millisecond", async () => {
    await database.put(NODE_STORE, node({ id: "b", kind: "serp", query: "b", createdAt: 4 }));
    await database.put(NODE_STORE, node({ id: "a", kind: "serp", query: "a", createdAt: 4 }));

    expect(await readSessionRoot(database, "session-1")).toMatchObject({ id: "a" });
  });
});
