import { describe, expect, it } from "vitest";

import { buildEntityEdges, type ClusterEntity } from ".";

const entity = (factCount: number, ...nodeIds: string[]): ClusterEntity => ({
  name: "Pixel 10a",
  factCount,
  pages: nodeIds.map((nodeId) => ({ nodeId, factCount: 1 })),
});

describe("buildEntityEdges", () => {
  it("chains an entity's pages in the order they were recorded", () => {
    expect(buildEntityEdges(["a", "b", "c", "d"], [entity(4, "c", "a", "d")])).toEqual([
      { from: "a", to: "c", weight: 1 },
      { from: "c", to: "d", weight: 1 },
    ]);
  });

  it("joins nothing through an entity with too few facts", () => {
    expect(buildEntityEdges(["a", "b"], [entity(2, "a", "b")])).toEqual([]);
  });

  it("adds n - 1 edges for an entity on n pages, not every pair", () => {
    const ids = Array.from({ length: 40 }, (_, index) => `p${index}`);

    expect(buildEntityEdges(ids, [entity(80, ...ids)])).toHaveLength(39);
  });

  it("leaves out a page clustering does not place, and one page alone joins nothing", () => {
    expect(buildEntityEdges(["a", "b"], [entity(5, "a", "gone")])).toEqual([]);
  });
});
