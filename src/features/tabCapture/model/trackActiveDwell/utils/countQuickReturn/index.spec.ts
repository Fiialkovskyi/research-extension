import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { countQuickReturn } from ".";
import {
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
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
    activeDwellMs: 4_000,
    maxScroll: 0.3,
    copyEvents: 0,
    focusCount: 1,
    revisitCount: 0,
    quickReturnCount: 0,
  },
  tabState: "open",
  createdAt: 1,
  ...overrides,
});

const SERP = buildNode("serp", { kind: "serp", query: "e-bike motors" });
const visit = (nodeId: string, visitDwellMs = 4_000, isRevisit = false) => ({
  nodeId,
  since: null,
  visitDwellMs,
  isRevisit,
  isRevisitCounted: false,
});

const readQuickReturns = async (id: string) =>
  (await database.get(NODE_STORE, id))?.signals.quickReturnCount;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(NODE_STORE);
  await database.put(NODE_STORE, SERP);
  await database.put(NODE_STORE, buildNode("from-search", { parentNodeId: "serp" }));
  await database.put(NODE_STORE, buildNode("opened-from-search", { openerNodeId: "serp" }));
  await database.put(NODE_STORE, buildNode("plain"));
});

describe("countQuickReturn", () => {
  it("counts a page reached from a search and left for a search at once", async () => {
    expect(await countQuickReturn(database, visit("from-search"), SERP)).toBe(true);
    expect(await countQuickReturn(database, visit("opened-from-search"), SERP)).toBe(true);
    expect(await readQuickReturns("from-search")).toBe(1);
    expect(await readQuickReturns("opened-from-search")).toBe(1);
  });

  it("does not count a page read for 10 s or more", async () => {
    expect(await countQuickReturn(database, visit("from-search", 10_000), SERP)).toBe(false);
    expect(await readQuickReturns("from-search")).toBe(0);
  });

  it("does not count a revisit", async () => {
    expect(await countQuickReturn(database, visit("from-search", 2_000, true), SERP)).toBe(false);
  });

  it("does not count a page not reached from a search", async () => {
    expect(await countQuickReturn(database, visit("plain"), SERP)).toBe(false);
  });

  it("does not count leaving for a page that is not a search", async () => {
    expect(await countQuickReturn(database, visit("from-search"), buildNode("other"))).toBe(false);
  });
});
