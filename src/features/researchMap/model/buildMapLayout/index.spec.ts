import { describe, expect, it } from "vitest";

import { MAP_NODE_HEIGHT, MAP_NODE_WIDTH } from "../../constants";
import type { GraphSnapshot, MapNode } from "../../types";
import { buildMapLayout } from ".";

const buildNode = (id: string, overrides: Partial<MapNode> = {}): MapNode => ({
  id,
  title: id.toUpperCase(),
  url: `https://example.com/${id}`,
  domain: "example.com",
  kind: "page",
  tabId: 1,
  tabState: "open",
  engagement: "skimmed",
  copyEvents: 0,
  pasteEvents: 0,
  activeDwellMs: 0,
  focusCount: 0,
  revisitCount: 0,
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  createdAt: 0,
  ...overrides,
});

/** A loaded B in the same tab, and B opened C in a new one. */
const snapshot: GraphSnapshot = {
  session: { id: "session-1", title: "E-bike motors" },
  nodes: [
    buildNode("a", { tabState: "closed" }),
    buildNode("b", { parentNodeId: "a" }),
    buildNode("c", { tabId: 2, openerNodeId: "b" }),
  ],
  edges: [
    { id: "a|b|sameTab", from: "a", to: "b", kind: "sameTab" },
    { id: "b|c|opener", from: "b", to: "c", kind: "opener" },
  ],
  clusters: [],
  activity: [],
};

const readPosition = (layout: ReturnType<typeof buildMapLayout>, id: string) => {
  const node = layout.nodes.find((candidate) => candidate.id === id);

  if (node === undefined) {
    throw new Error(`No node "${id}" in the layout.`);
  }

  return node.position;
};

describe("buildMapLayout", () => {
  it("places a page below the page it was reached from", () => {
    const layout = buildMapLayout(snapshot);

    expect(readPosition(layout, "b").y).toBeGreaterThan(readPosition(layout, "a").y);
    expect(readPosition(layout, "c").y).toBeGreaterThan(readPosition(layout, "b").y);
  });

  it("positions nodes by their top-left corner", () => {
    const layout = buildMapLayout({ ...snapshot, nodes: [buildNode("a")], edges: [] });

    // A lone node is centred on half its box, so its corner is at the origin.
    expect(readPosition(layout, "a")).toEqual({ x: 0, y: 0 });
    expect(layout.nodes[0]).toMatchObject({ width: MAP_NODE_WIDTH, height: MAP_NODE_HEIGHT });
  });

  it("declares each node's size and handles, so its edges never wait for a measurement", () => {
    const [node] = buildMapLayout({ ...snapshot, nodes: [buildNode("a")], edges: [] }).nodes;

    expect(node?.measured).toEqual({ width: MAP_NODE_WIDTH, height: MAP_NODE_HEIGHT });
    expect(node?.handles).toEqual([
      expect.objectContaining({ type: "target", x: MAP_NODE_WIDTH / 2, y: 0 }),
      expect.objectContaining({ type: "source", x: MAP_NODE_WIDTH / 2, y: MAP_NODE_HEIGHT }),
    ]);
  });

  it("styles each edge by its kind, dashing openers", () => {
    const { edges } = buildMapLayout(snapshot);

    expect(edges).toEqual([
      expect.objectContaining({
        id: "a|b|sameTab",
        source: "a",
        target: "b",
        className: "edge-sameTab",
      }),
      expect.objectContaining({
        id: "b|c|opener",
        source: "b",
        target: "c",
        className: "edge-opener",
        style: { strokeDasharray: "6 4" },
      }),
    ]);
    expect(edges[0]).not.toHaveProperty("style");
  });

  it("draws co-attention without an arrow and in a dash of its own, and ranks nothing by it", () => {
    // C and D were both opened from B and compared side by side.
    const compared: GraphSnapshot = {
      ...snapshot,
      nodes: [...snapshot.nodes, buildNode("d", { tabId: 3, openerNodeId: "b" })],
      edges: [...snapshot.edges, { id: "b|d|opener", from: "b", to: "d", kind: "opener" }],
    };
    const withCoAttention = buildMapLayout({
      ...compared,
      edges: [
        ...compared.edges,
        { id: "c|d|coAttention", from: "c", to: "d", kind: "coAttention" },
      ],
    });
    const without = buildMapLayout(compared);
    const coAttention = withCoAttention.edges.find(({ id }) => id === "c|d|coAttention");
    const dashes = withCoAttention.edges.map(({ style }) => style?.strokeDasharray);

    expect(coAttention).toMatchObject({
      className: "edge-coAttention",
      style: { strokeDasharray: "1 3 6 3" },
    });
    expect(coAttention).not.toHaveProperty("markerEnd");
    expect(new Set(dashes).size).toBe(dashes.length - 1);
    expect(["c", "d"].map((id) => readPosition(withCoAttention, id))).toEqual(
      ["c", "d"].map((id) => readPosition(without, id)),
    );
  });

  it("carries what a node renders, falling back to the URL for a blank title", () => {
    const layout = buildMapLayout({
      ...snapshot,
      nodes: [buildNode("a", { title: "  ", tabState: "closed", tabId: 9 })],
      edges: [],
    });

    expect(layout.nodes[0]).toMatchObject({
      id: "a",
      type: "page",
      data: {
        label: "https://example.com/a",
        domain: "example.com",
        kind: "page",
        tabId: 9,
        tabState: "closed",
        engagement: "skimmed",
      },
    });
  });

  it("labels a search by its query, dots refinement edges, and ranks a refined search below the root", () => {
    const layout = buildMapLayout({
      ...snapshot,
      nodes: [
        buildNode("root", { kind: "serp", query: "e-bike motors" }),
        buildNode("refined", { tabId: 2, kind: "serp", query: "e-bike mid-drive motors" }),
      ],
      edges: [{ id: "root|refined|refinement", from: "root", to: "refined", kind: "refinement" }],
    });

    expect(layout.nodes[0]?.data).toMatchObject({ label: "e-bike motors", kind: "serp" });
    expect(layout.edges[0]).toMatchObject({
      className: "edge-refinement",
      style: { strokeDasharray: "2 4" },
    });
    expect(readPosition(layout, "refined").y).toBeGreaterThan(readPosition(layout, "root").y);
  });

  it("lays out nothing for an empty snapshot", () => {
    expect(
      buildMapLayout({ session: null, nodes: [], edges: [], clusters: [], activity: [] }),
    ).toEqual({
      nodes: [],
      edges: [],
    });
  });

  it("drops an edge whose node the snapshot does not hold", () => {
    const layout = buildMapLayout({ ...snapshot, nodes: [buildNode("a")], edges: snapshot.edges });

    expect(layout.nodes.map((node) => node.id)).toEqual(["a"]);
    expect(layout.edges).toEqual([]);
  });
});
