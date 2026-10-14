import { describe, expect, it } from "vitest";

import { buildAnchorLinks } from ".";
import type { MapActivity } from "../../types";

const read = (nodeId: string, at: number): MapActivity => ({
  nodeId,
  kind: "focus",
  at,
  endAt: at + 1,
});

const ANCHORS = new Set(["a", "b", "c"]);

describe("buildAnchorLinks", () => {
  it("counts the moves between two anchors in each direction", () => {
    expect(
      buildAnchorLinks(ANCHORS, [read("a", 1), read("b", 2), read("a", 3), read("b", 4)], []),
    ).toEqual([{ from: "a", to: "b", forward: 2, backward: 1 }]);
  });

  it("joins two anchors read with other pages in between", () => {
    expect(
      buildAnchorLinks(ANCHORS, [read("a", 1), read("forum", 2), read("x", 3), read("c", 4)], []),
    ).toEqual([{ from: "a", to: "c", forward: 1, backward: 0 }]);
  });

  it("reads the intervals in time order, and ignores copies", () => {
    expect(
      buildAnchorLinks(
        ANCHORS,
        [read("b", 5), { nodeId: "c", kind: "copy", at: 3, endAt: 3 }, read("a", 1)],
        [],
      ),
    ).toEqual([{ from: "a", to: "b", forward: 1, backward: 0 }]);
  });

  it("falls back to co-attention between anchors when nothing was logged", () => {
    expect(
      buildAnchorLinks(
        ANCHORS,
        [],
        [
          { id: "1", from: "a", to: "b", kind: "coAttention" },
          { id: "2", from: "a", to: "x", kind: "coAttention" },
          { id: "3", from: "b", to: "c", kind: "opener" },
        ],
      ),
    ).toEqual([{ from: "a", to: "b", forward: 1, backward: 1 }]);
  });
});
