import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { readSessionGraph } from ".";
import type { NewNode } from "../../types";
import { recordEdge } from "../recordEdge";
import { recordNode } from "../recordNode";
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

const page = (sessionId: string, url: string): NewNode => ({
  sessionId,
  tabId: 7,
  kind: "page",
  url,
  domain: "example.org",
  title: url,
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
});

describe("readSessionGraph", () => {
  it("returns an empty graph for a session with nothing recorded", async () => {
    expect(await readSessionGraph(database, "session-1")).toEqual({ nodes: [], edges: [] });
  });

  it("returns the session's nodes and edges and none of another session's", async () => {
    const a = await recordNode(database, page("session-1", "https://example.org/a"));
    const b = await recordNode(database, page("session-1", "https://example.org/b"));
    const other = await recordNode(database, page("session-2", "https://example.org/c"));
    await recordEdge(database, {
      sessionId: "session-1",
      kind: "opener",
      from: a.id,
      to: b.id,
      weight: 1,
    });
    await recordEdge(database, {
      sessionId: "session-2",
      kind: "opener",
      from: other.id,
      to: other.id,
      weight: 1,
    });

    const graph = await readSessionGraph(database, "session-1");

    expect(graph.nodes.map((node) => node.id).toSorted()).toEqual([a.id, b.id].toSorted());
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({ from: a.id, to: b.id });
  });
});
