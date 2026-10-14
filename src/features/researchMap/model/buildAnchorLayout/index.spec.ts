import { describe, expect, it } from "vitest";

import { buildAnchorLayout } from ".";
import type { GraphSnapshot, MapNode } from "../../types";

const page = (id: string, createdAt: number, overrides: Partial<MapNode> = {}): MapNode => ({
  id,
  title: `Page ${id}`,
  url: `https://example.org/${id}`,
  domain: "example.org",
  kind: "page",
  tabId: 1,
  tabState: "open",
  engagement: "skimmed",
  copyEvents: 0,
  pasteEvents: 0,
  activeDwellMs: 1_000,
  focusCount: 1,
  revisitCount: 0,
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  createdAt,
  ...overrides,
});

const SNAPSHOT: GraphSnapshot = {
  session: { id: "s", title: "S" },
  nodes: [
    page("search", 1, { kind: "serp", query: "best mid-drive" }),
    page("vado", 2, { revisitCount: 3, copyEvents: 2, activeDwellMs: 420_000, focusCount: 4 }),
    page("allant", 3, { revisitCount: 2, activeDwellMs: 480_000 }),
    page("notes", 4, { pasteEvents: 6, activeDwellMs: 300_000 }),
    page("forum", 5),
  ],
  edges: [
    { id: "search|vado|opener", from: "search", to: "vado", kind: "opener" },
    { id: "search|forum|opener", from: "search", to: "forum", kind: "opener" },
    { id: "forum|allant|sameTab", from: "forum", to: "allant", kind: "sameTab" },
  ],
  clusters: [],
  activity: [
    { nodeId: "vado", kind: "focus", at: 10, endAt: 20 },
    { nodeId: "forum", kind: "focus", at: 20, endAt: 30 },
    { nodeId: "allant", kind: "focus", at: 30, endAt: 40 },
    { nodeId: "vado", kind: "focus", at: 40, endAt: 50 },
    { nodeId: "notes", kind: "focus", at: 50, endAt: 60 },
  ],
};

describe("buildAnchorLayout", () => {
  it("draws the anchors and the page the session began from, nothing else", () => {
    const { nodes, anchorCount } = buildAnchorLayout(SNAPSHOT, false);

    expect(anchorCount).toBe(3);
    expect(nodes.map(({ id, data }) => [id, data.role])).toEqual([
      ["search", "root"],
      ["vado", "anchor"],
      ["allant", "anchor"],
      ["notes", "anchor"],
    ]);
  });

  it("puts the starting page above the ring of anchors", () => {
    const { nodes } = buildAnchorLayout(SNAPSHOT, false);
    const rootBottom = (nodes.find(({ id }) => id === "search")?.position.y ?? 0) + 64;

    for (const node of nodes.filter(({ data }) => data.role === "anchor")) {
      expect(node.position.y).toBeGreaterThan(rootBottom);
    }
  });

  it("joins anchors the user moved between, with arrows both ways when they went back", () => {
    const { edges } = buildAnchorLayout(SNAPSHOT, false);

    expect(
      edges.map(({ source, target, markerStart }) => [source, target, markerStart !== undefined]),
    ).toEqual([
      ["vado", "allant", true],
      ["vado", "notes", false],
    ]);
  });

  it("sizes an anchor by its reading time, and marks a page written into", () => {
    const { nodes } = buildAnchorLayout(SNAPSHOT, false);
    const read = (id: string) => nodes.find((node) => node.id === id)?.data;

    expect(read("allant")?.width).toBeGreaterThan(read("notes")?.width ?? Infinity);
    expect(read("notes")?.isCollector).toBe(true);
    expect(read("vado")).toMatchObject({ visits: 4, copyEvents: 2, isCollector: false });
  });

  it("adds every other page and the paths between them when asked", () => {
    const { nodes, edges } = buildAnchorLayout(SNAPSHOT, true);

    expect(nodes.find(({ id }) => id === "forum")?.data.role).toBe("page");
    expect(edges.map(({ className }) => className)).toEqual([
      "edge-path",
      "edge-path",
      "edge-path",
      "edge-anchor",
      "edge-anchor",
    ]);
  });

  it("draws only the starting page in a session without anchors", () => {
    const { nodes, edges, anchorCount } = buildAnchorLayout(
      { ...SNAPSHOT, nodes: [page("search", 1), page("forum", 2)], activity: [] },
      false,
    );

    expect(anchorCount).toBe(0);
    expect(nodes.map(({ id }) => id)).toEqual(["search"]);
    expect(edges).toEqual([]);
  });
});
