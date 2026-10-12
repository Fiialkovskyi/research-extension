import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { linkRefinement } from ".";
import { type NewNode, recordNode } from "@/features/researchGraph";
import {
  EDGE_STORE,
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  // Only the clock: the database's own timers keep running.
  vi.useFakeTimers({ toFake: ["Date"] });
  database = await openResearchDatabase();
  await Promise.all([database.clear(NODE_STORE), database.clear(EDGE_STORE)]);
});

const search = (query: string): NewNode => ({
  sessionId: "session-1",
  tabId: 7,
  kind: "serp",
  query,
  url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
  domain: "duckduckgo.com",
  title: query,
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "typed",
});

afterEach(() => {
  vi.useRealTimers();
});

/** Records a node and links it, as capture does, a millisecond after the last. */
const recordSearch = async (query: string) => {
  vi.advanceTimersByTime(1);

  const node = await recordNode(database, search(query));

  await linkRefinement(database, node);

  return node;
};

describe("linkRefinement", () => {
  it("links nothing to the first search, which becomes the root", async () => {
    await recordSearch("e-bike motors");

    expect(await database.count(EDGE_STORE)).toBe(0);
  });

  it("links a search for a different query from the root", async () => {
    const root = await recordSearch("e-bike motors");
    const refined = await recordSearch("e-bike mid-drive motors");

    expect(await database.getAll(EDGE_STORE)).toEqual([
      expect.objectContaining({ kind: "refinement", from: root.id, to: refined.id, weight: 0.3 }),
    ]);
  });

  it("links a search recorded in the same millisecond as the root", async () => {
    const root = await recordNode(database, search("e-bike motors"));
    await linkRefinement(database, root);
    const refined = await recordNode(database, search("hub motor"));
    await linkRefinement(database, refined);

    expect(await database.getAll(EDGE_STORE)).toEqual([
      expect.objectContaining({ from: root.id, to: refined.id }),
    ]);
  });

  it("does not link the same query differing only in case or whitespace", async () => {
    await recordSearch("e-bike motors");
    await recordSearch("E-bike   Motors");

    expect(await database.count(EDGE_STORE)).toBe(0);
  });

  it("links nothing for a plain page", async () => {
    await recordSearch("e-bike motors");
    const page = await recordNode(database, {
      ...search("ignored"),
      kind: "page",
      query: undefined,
      url: "https://example.org",
    });

    await linkRefinement(database, page);

    expect(await database.count(EDGE_STORE)).toBe(0);
  });
});
