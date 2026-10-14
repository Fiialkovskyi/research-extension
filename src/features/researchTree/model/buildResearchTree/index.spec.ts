import { describe, expect, it } from "vitest";

import { buildResearchTree, type TreeRow } from ".";
import type { MapNode } from "@/features/researchMap";

const buildNode = (id: string, overrides: Partial<MapNode> = {}): MapNode => ({
  id,
  title: id,
  url: `https://example.org/${id}`,
  domain: "example.org",
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

/** The tree as nested ids, which is what these cases are about. */
const readShape = (rows: TreeRow[]): unknown[] =>
  rows.map(({ id, children }) => (children.length === 0 ? id : [id, readShape(children)]));

const cluster = (id: string, label: string, memberIds: string[]) => ({ id, label, memberIds });

describe("buildResearchTree", () => {
  it("puts a search at the top, a result opened from it under it, and a link followed in the result under that", () => {
    const tree = buildResearchTree([
      buildNode("b", { parentNodeId: "a", createdAt: 3 }),
      buildNode("search", { kind: "serp", query: "e-bike motors", createdAt: 1 }),
      buildNode("a", { openerNodeId: "search", tabId: 2, createdAt: 2 }),
    ]);

    expect(readShape(tree)).toEqual([["search", [["a", ["b"]]]]]);
  });

  it("prefers the previous page in the tab to the page that opened the tab", () => {
    const tree = buildResearchTree([
      buildNode("p", { createdAt: 1 }),
      buildNode("o", { createdAt: 2 }),
      buildNode("c", { parentNodeId: "p", openerNodeId: "o", createdAt: 3 }),
    ]);

    expect(readShape(tree)).toEqual([["p", ["c"]], "o"]);
  });

  it("makes a page whose source is not in the graph a root", () => {
    expect(readShape(buildResearchTree([buildNode("c", { parentNodeId: "gone" })]))).toEqual(["c"]);
  });

  it("orders siblings as they were recorded, then by id", () => {
    const tree = buildResearchTree([
      buildNode("root"),
      buildNode("y", { openerNodeId: "root", createdAt: 2 }),
      buildNode("x", { openerNodeId: "root", createdAt: 2 }),
      buildNode("w", { openerNodeId: "root", createdAt: 1 }),
    ]);

    expect(readShape(tree)).toEqual([["root", ["w", "x", "y"]]]);
  });

  it("places every page once, even pages that point at each other", () => {
    const tree = buildResearchTree([
      buildNode("a", { parentNodeId: "b", createdAt: 1 }),
      buildNode("b", { parentNodeId: "a", createdAt: 2 }),
    ]);

    expect(JSON.stringify(readShape(tree)).match(/"a"/g)).toHaveLength(1);
    expect(JSON.stringify(readShape(tree)).match(/"b"/g)).toHaveLength(1);
  });

  describe("grouped by cluster", () => {
    const nodes = [
      buildNode("s1", { kind: "serp", query: "e-bike motors", createdAt: 1 }),
      buildNode("a", { openerNodeId: "s1", createdAt: 2 }),
      buildNode("s2", { kind: "serp", query: "battery range", createdAt: 3 }),
      buildNode("c", { openerNodeId: "s2", createdAt: 4 }),
      buildNode("lone", { createdAt: 5 }),
      // Reached from A, but clustered with the second search.
      buildNode("x", { parentNodeId: "a", createdAt: 6 }),
    ];
    const clusters = [
      cluster("k2", "battery range", ["s2", "c", "x"]),
      cluster("k1", "e-bike motors", ["s1", "a"]),
      cluster("k3", "Page lone", ["lone"]),
    ];

    it("puts each cluster of two or more at the top, in the order its first page came, and pools the rest", () => {
      expect(readShape(buildResearchTree(nodes, clusters))).toEqual([
        ["cluster:k1", [["s1", ["a"]]]],
        ["cluster:k2", [["s2", ["c"]], "x"]],
        ["cluster:unclustered", ["lone"]],
      ]);
    });

    it("names a cluster row by its label and counts its pages", () => {
      const [first, , pool] = buildResearchTree(nodes, clusters);

      expect(first).toMatchObject({ kind: "cluster", label: "e-bike motors", size: 2 });
      expect(pool).toMatchObject({ kind: "cluster", label: "Unclustered", size: 1 });
    });

    it("leaves the tree ungrouped with one cluster or none", () => {
      expect(
        readShape(
          buildResearchTree(nodes, [
            cluster(
              "k",
              "all",
              nodes.map(({ id }) => id),
            ),
          ]),
        ),
      ).toEqual(readShape(buildResearchTree(nodes)));
    });

    it("pools pages no cluster names, and leaves out an empty pool", () => {
      const shape = readShape(
        buildResearchTree(nodes.slice(0, 4), [
          cluster("k1", "e-bike motors", ["s1", "a"]),
          cluster("k2", "battery range", ["s2", "c"]),
        ]),
      );

      expect(shape).toEqual([
        ["cluster:k1", [["s1", ["a"]]]],
        ["cluster:k2", [["s2", ["c"]]]],
      ]);
    });
  });
});
