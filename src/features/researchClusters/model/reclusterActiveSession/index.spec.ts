import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { reclusterActiveSession } from ".";
import { readClustering } from "../readClustering";
import {
  CLUSTERING_STORE,
  EDGE_STORE,
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredNode,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

const page = (id: string, createdAt: number): StoredNode => ({
  id,
  sessionId: "session-1",
  tabId: 1,
  kind: "page",
  url: `https://example.org/${id}`,
  domain: "example.org",
  title: `Page ${id}`,
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  signals: {
    activeDwellMs: 20_000,
    maxScroll: 0.5,
    copyEvents: 0,
    focusCount: 1,
    revisitCount: 0,
    quickReturnCount: 0,
  },
  tabState: "open",
  createdAt,
});

beforeEach(async () => {
  database = await openResearchDatabase();
  await Promise.all([
    database.clear(SESSION_STORE),
    database.clear(NODE_STORE),
    database.clear(EDGE_STORE),
    database.clear(CLUSTERING_STORE),
  ]);
  await database.put(SESSION_STORE, {
    id: "session-1",
    title: "E-bike motors",
    groupId: 42,
    formerGroupIds: [],
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  });
  await database.put(NODE_STORE, page("a", 1));
  await database.put(NODE_STORE, page("b", 2));
  await database.put(EDGE_STORE, {
    id: "a|b|opener",
    sessionId: "session-1",
    kind: "opener",
    from: "a",
    to: "b",
    weight: 1,
    createdAt: 2,
  });
});

describe("reclusterActiveSession", () => {
  it("clusters the active session's graph and stores the result", async () => {
    const clustering = await reclusterActiveSession(database, 50);

    expect(clustering?.clusters.map(({ memberIds }) => memberIds)).toEqual([["a", "b"]]);
    expect(await readClustering(database, "session-1")).toEqual(clustering);
  });

  it("keeps the cluster's id from the last run", async () => {
    const first = await reclusterActiveSession(database, 50);

    await database.put(NODE_STORE, { ...page("c", 3), parentNodeId: "b" });
    await database.put(EDGE_STORE, {
      id: "b|c|sameTab",
      sessionId: "session-1",
      kind: "sameTab",
      from: "b",
      to: "c",
      weight: 0.5,
      createdAt: 3,
    });

    const again = await reclusterActiveSession(database, 60);

    expect(again?.clusters[0]?.id).toBe(first?.clusters[0]?.id);
    expect(again?.clusters[0]?.memberIds).toEqual(["a", "b", "c"]);
  });

  it("does nothing without an active session", async () => {
    await database.clear(SESSION_STORE);

    expect(await reclusterActiveSession(database)).toBeUndefined();
    expect(await database.count(CLUSTERING_STORE)).toBe(0);
  });
});
