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
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  createdAt: 0,
  ...overrides,
});

/** The tree as nested ids, which is what these cases are about. */
const readShape = (rows: TreeRow[]): unknown[] =>
  rows.map(({ node, children }) =>
    children.length === 0 ? node.id : [node.id, readShape(children)],
  );

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
});
