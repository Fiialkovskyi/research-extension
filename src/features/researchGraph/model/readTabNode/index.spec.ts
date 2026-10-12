import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { readTabNode } from ".";
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

const node = (overrides: Partial<StoredNode> & { id: string }): StoredNode => ({
  sessionId: "session-1",
  tabId: 7,
  kind: "page",
  url: "https://example.org",
  domain: "example.org",
  title: "Example",
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  signals: { activeDwellMs: 0, maxScroll: 0, copyEvents: 0, focusCount: 0, revisitCount: 0 },
  tabState: "open",
  createdAt: 1,
  ...overrides,
});

describe("readTabNode", () => {
  it("returns undefined for a tab with no node", async () => {
    expect(await readTabNode(database, "session-1", 7)).toBeUndefined();
  });

  it("returns the newest node the tab navigated to", async () => {
    await database.put(NODE_STORE, node({ id: "first", createdAt: 1 }));
    await database.put(NODE_STORE, node({ id: "second", createdAt: 2, parentNodeId: "first" }));

    expect((await readTabNode(database, "session-1", 7))?.id).toBe("second");
  });

  it("never returns a closed node, even when its tab id was reused", async () => {
    await database.put(
      NODE_STORE,
      node({ id: "before-restart", createdAt: 5, tabState: "closed" }),
    );

    expect(await readTabNode(database, "session-1", 7)).toBeUndefined();

    await database.put(NODE_STORE, node({ id: "after-restart", createdAt: 3 }));

    expect((await readTabNode(database, "session-1", 7))?.id).toBe("after-restart");
  });

  it("ignores the same tab id in another session", async () => {
    await database.put(NODE_STORE, node({ id: "elsewhere", sessionId: "session-2" }));

    expect(await readTabNode(database, "session-1", 7)).toBeUndefined();
  });
});
