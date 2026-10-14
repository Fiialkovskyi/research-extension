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
  signals: {
    activeDwellMs: 5,
    maxScroll: 0.5,
    copyEvents: 1,
    pasteEvents: 0,
    focusCount: 2,
    revisitCount: 0,
    quickReturnCount: 0,
  },
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
          engagement: "deep_read",
          copyEvents: 1,
          pasteEvents: 0,
          activeDwellMs: 5,
          focusCount: 2,
          revisitCount: 0,
          parentNodeId: null,
          openerNodeId: null,
          transitionType: "typed",
          createdAt: 10,
        },
      ],
      edges: [{ id: "node-a|node-b|sameTab", from: "node-a", to: "node-b", kind: "sameTab" }],
      clusters: [],
      activity: [],
    });
  });

  it("carries the session's clusters", () => {
    const clusters = [{ id: "k", label: "e-bike motors", memberIds: ["node-a"] }];

    expect(buildGraphSnapshot(session, { nodes: [node], edges: [] }, clusters).clusters).toEqual(
      clusters,
    );
  });

  it("carries the session's activity as times and pages only", () => {
    const activity = [
      {
        id: "activity-1",
        sessionId: "session-1",
        nodeId: "node-a",
        kind: "focus" as const,
        at: 100,
        endAt: 900,
      },
    ];

    expect(
      buildGraphSnapshot(session, { nodes: [node], edges: [] }, [], activity).activity,
    ).toEqual([{ nodeId: "node-a", kind: "focus", at: 100, endAt: 900 }]);
  });

  it("carries a SERP's kind and query", () => {
    const serp: StoredNode = { ...node, kind: "serp", query: "e-bike motors" };

    expect(buildGraphSnapshot(session, { nodes: [serp], edges: [] }).nodes[0]).toMatchObject({
      kind: "serp",
      query: "e-bike motors",
    });
  });

  it("derives each page's engagement, and does not call the focused page a dead end", () => {
    const glance: StoredNode = {
      ...node,
      tabState: "open",
      signals: {
        activeDwellMs: 3_000,
        maxScroll: 0,
        copyEvents: 0,
        pasteEvents: 0,
        focusCount: 1,
        revisitCount: 0,
        quickReturnCount: 0,
      },
    };
    const unread: StoredNode = {
      ...glance,
      id: "node-b",
      signals: { ...glance.signals, focusCount: 0 },
    };
    const focused = {
      ...session,
      focus: {
        nodeId: "node-a",
        since: 20,
        visitDwellMs: 3_000,
        isRevisit: false,
        isRevisitCounted: false,
      },
    };
    const engagements = (current: StoredSession) =>
      buildGraphSnapshot(current, { nodes: [glance, unread], edges: [] }).nodes.map(
        ({ engagement }) => engagement,
      );

    expect(engagements(focused)).toEqual(["skimmed", "unread"]);
    expect(engagements(session)).toEqual(["dead_end", "unread"]);
  });

  it("draws nothing without an active session", () => {
    expect(buildGraphSnapshot(undefined, { nodes: [node], edges: [edge] })).toEqual({
      session: null,
      nodes: [],
      edges: [],
      clusters: [],
      activity: [],
    });
  });

  it("builds a message the map accepts", () => {
    const snapshot = buildGraphSnapshot(session, { nodes: [node], edges: [edge] });

    expect(v.parse(graphSnapshotSchema, snapshot)).toEqual(snapshot);
  });
});
