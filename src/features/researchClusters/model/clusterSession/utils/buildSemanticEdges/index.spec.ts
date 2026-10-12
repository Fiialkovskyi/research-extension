import { describe, expect, it } from "vitest";

import { buildSemanticEdges } from ".";

/** A unit vector at `angle` radians in the plane. */
const at = (angle: number) => new Float32Array([Math.cos(angle), Math.sin(angle)]);

/** The angle whose cosine is `similarity`. */
const similar = (similarity: number) => at(Math.acos(similarity));

const semantic = (entries: [string, Float32Array][]) => ({
  spaceId: "space-1",
  vectors: new Map(entries),
});

describe("buildSemanticEdges", () => {
  it("joins two similar pages, weighted by how far above the threshold they are", () => {
    const [edge] = buildSemanticEdges(
      ["a", "b"],
      semantic([
        ["a", at(0)],
        ["b", similar(0.9)],
      ]),
    );

    expect(edge).toMatchObject({ from: "a", to: "b" });
    expect(edge?.weight).toBeCloseTo((1.2 * (0.9 - 0.55)) / 0.45, 5);
  });

  it("joins nothing below the threshold", () => {
    expect(
      buildSemanticEdges(
        ["a", "b"],
        semantic([
          ["a", at(0)],
          ["b", similar(0.5)],
        ]),
      ),
    ).toEqual([]);
  });

  it("leaves out pages without a vector, and pages not taking part", () => {
    expect(
      buildSemanticEdges(
        ["a", "b"],
        semantic([
          ["a", at(0)],
          ["outside", at(0)],
        ]),
      ),
    ).toEqual([]);
  });

  it("gives the pairs in the order the pages were given", () => {
    const vectors = semantic([
      ["a", at(0)],
      ["b", at(0)],
      ["c", at(0)],
    ]);

    expect(
      buildSemanticEdges(["c", "a", "b"], vectors).map(({ from, to }) => `${from}-${to}`),
    ).toEqual(["c-a", "c-b", "a-b"]);
  });
});
