import { describe, expect, it } from "vitest";

import { moveTreeFocus, type TreeKey } from ".";
import type { MapNode } from "@/features/researchMap";
import type { TreeRow } from "../buildResearchTree";
import { listVisibleRows } from "../listVisibleRows";

const row = (id: string, children: TreeRow[] = []): TreeRow => ({
  kind: "page",
  id,
  node: { id } as MapNode,
  children,
});

/** search ▸ a ▸ b, search ▸ c; other. */
const forest = [row("search", [row("a", [row("b")]), row("c")]), row("other")];

const press = (focusedId: string | undefined, key: TreeKey, collapsed: string[] = []) => {
  const closed = new Set(collapsed);
  const next = moveTreeFocus(
    listVisibleRows(forest, closed),
    { focusedId, collapsed: closed },
    key,
  );

  return { focusedId: next.focusedId, collapsed: [...next.collapsed].toSorted() };
};

describe("moveTreeFocus", () => {
  it("moves down and up through the visible rows, stopping at the ends", () => {
    expect(press("search", "ArrowDown").focusedId).toBe("a");
    expect(press("b", "ArrowDown").focusedId).toBe("c");
    expect(press("other", "ArrowDown").focusedId).toBe("other");
    expect(press("search", "ArrowUp").focusedId).toBe("search");
    expect(press("c", "ArrowUp").focusedId).toBe("b");
  });

  it("skips the children of a collapsed row", () => {
    expect(press("a", "ArrowDown", ["a"]).focusedId).toBe("c");
  });

  it("expands a collapsed row with Right, then moves into it", () => {
    expect(press("a", "ArrowRight", ["a"])).toEqual({ focusedId: "a", collapsed: [] });
    expect(press("a", "ArrowRight").focusedId).toBe("b");
  });

  it("does nothing with Right on a row without children", () => {
    expect(press("b", "ArrowRight")).toEqual({ focusedId: "b", collapsed: [] });
  });

  it("collapses an expanded row with Left, then moves to its parent", () => {
    expect(press("a", "ArrowLeft")).toEqual({ focusedId: "a", collapsed: ["a"] });
    expect(press("a", "ArrowLeft", ["a"]).focusedId).toBe("search");
    expect(press("b", "ArrowLeft").focusedId).toBe("a");
  });

  it("stays on a root that has no children with Left", () => {
    expect(press("other", "ArrowLeft")).toEqual({ focusedId: "other", collapsed: [] });
  });

  it("jumps to the first and last visible row", () => {
    expect(press("b", "Home").focusedId).toBe("search");
    expect(press("a", "End").focusedId).toBe("other");
  });

  it("starts at the first row when nothing is focused", () => {
    expect(press(undefined, "ArrowDown").focusedId).toBe("search");
    expect(press("gone", "End").focusedId).toBe("search");
  });
});
