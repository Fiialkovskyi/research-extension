import * as v from "valibot";
import { describe, expect, it } from "vitest";

import type { StoredEdge, StoredNode, StoredSession } from "@/shared/storage";

import { graphSnapshotSchema } from "../../schemas";
import { buildGraphSnapshot } from ".";

const session: StoredSession = {
  id: "session-1",
  title: "E-bike motors",
  groupId: 42,
  formerGroupIds: [],
  status: "active",
  createdAt: 1,
  updatedAt: 2,
};

const node: StoredNode = {
  id: "node-a",
  sessionId: "session-1",
  tabId: 7,
  kind: "page",
  url: "https://example.com/a",
  domain: "example.com",
  title: "A",
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "typed",
  signals: { activeDwellMs: 5, maxScroll: 0.5, copyEvents: 1, focusCount: 2, revisitCount: 0 },
  tabState: "closed",
  createdAt: 10,
  lastFocusedAt: 11,
};

const edge: StoredEdge = {
  id: "node-a|node-b|sameTab",
  sessionId: "session-1",
  kind: "sameTab",
  from: "node-a",
  to: "node-b",
  weight: 0.5,
  createdAt: 12,
};

describe("buildGraphSnapshot", () => {
  it("keeps only what the map draws", () => {
    expect(buildGraphSnapshot(session, { nodes: [node], edges: [edge] })).toEqual({
      session: { id: "session-1", title: "E-bike motors" },
      nodes: [
        {
          id: "node-a",
          title: "A",
          url: "https://example.com/a",
          domain: "example.com",
          kind: "page",
          tabId: 7,
          tabState: "closed",
          parentNodeId: null,
          openerNodeId: null,
          transitionType: "typed",
          createdAt: 10,
        },
      ],
      edges: [{ id: "node-a|node-b|sameTab", from: "node-a", to: "node-b", kind: "sameTab" }],
    });
  });

  it("carries a SERP's kind and query", () => {
    const serp: StoredNode = { ...node, kind: "serp", query: "e-bike motors" };

    expect(buildGraphSnapshot(session, { nodes: [serp], edges: [] }).nodes[0]).toMatchObject({
      kind: "serp",
      query: "e-bike motors",
    });
  });

  it("draws nothing without an active session", () => {
    expect(buildGraphSnapshot(undefined, { nodes: [node], edges: [edge] })).toEqual({
      session: null,
      nodes: [],
      edges: [],
    });
  });

  it("builds a message the map accepts", () => {
    const snapshot = buildGraphSnapshot(session, { nodes: [node], edges: [edge] });

    expect(v.parse(graphSnapshotSchema, snapshot)).toEqual(snapshot);
  });
});
