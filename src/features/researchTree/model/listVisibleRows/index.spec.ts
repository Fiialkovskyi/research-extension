import { describe, expect, it } from "vitest";

import { listVisibleRows } from ".";
import type { MapNode } from "@/features/researchMap";
import type { TreeRow } from "../buildResearchTree";

const row = (id: string, children: TreeRow[] = []): TreeRow => ({
  kind: "page",
  id,
  node: { id } as MapNode,
  children,
});

const forest = [row("search", [row("a", [row("b")]), row("c")]), row("other")];

describe("listVisibleRows", () => {
  it("lists every row depth-first, with its level, place among siblings and children", () => {
    expect(
      listVisibleRows(forest, new Set()).map(
        ({ row: { id }, level, positionInSet, setSize, parentId, hasChildren }) => [
          id,
          level,
          positionInSet,
          setSize,
          parentId,
          hasChildren,
        ],
      ),
    ).toEqual([
      ["search", 1, 1, 2, null, true],
      ["a", 2, 1, 2, "search", true],
      ["b", 3, 1, 1, "a", false],
      ["c", 2, 2, 2, "search", false],
      ["other", 1, 2, 2, null, false],
    ]);
  });

  it("leaves out the children of a collapsed row, but keeps the row", () => {
    expect(listVisibleRows(forest, new Set(["a"])).map(({ row: { id } }) => id)).toEqual([
      "search",
      "a",
      "c",
      "other",
    ]);
  });
});
