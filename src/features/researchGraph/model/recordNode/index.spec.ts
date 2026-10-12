import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { recordNode } from ".";
import type { NewNode } from "../../types";
import {
  EDGE_STORE,
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(NODE_STORE);
  await database.clear(EDGE_STORE);
});

/** A page as capture would first report it. */
const page = (overrides: Partial<NewNode> = {}): NewNode => ({
  sessionId: "session-1",
  tabId: 7,
  kind: "page",
  url: "https://example.org/motors",
  domain: "example.org",
  title: "Motors",
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  ...overrides,
});

describe("recordNode", () => {
  it("records the page as an open node with no engagement yet", async () => {
    const node = await recordNode(database, page());

    expect(node).toMatchObject({
      sessionId: "session-1",
      tabId: 7,
      url: "https://example.org/motors",
      tabState: "open",
      signals: { activeDwellMs: 0, maxScroll: 0, copyEvents: 0, focusCount: 0, revisitCount: 0 },
    });
    expect(await database.get(NODE_STORE, node.id)).toEqual(node);
  });

  it("records the same URL twice as two nodes, one per visit", async () => {
    const first = await recordNode(database, page());
    const second = await recordNode(database, page({ parentNodeId: first.id }));

    expect(second.id).not.toBe(first.id);
    expect(await database.count(NODE_STORE)).toBe(2);
  });
});
