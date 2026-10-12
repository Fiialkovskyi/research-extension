import type { MapNode } from "@/features/researchMap";

import type { TreeRow } from "../buildResearchTree";

/** A row as the tree draws it, with what the WAI-ARIA tree pattern exposes. */
export interface VisibleRow {
  node: MapNode;
  /** 1 for a root. */
  level: number;
  /** 1-based position among its siblings. */
  positionInSet: number;
  setSize: number;
  parentId: string | null;
  hasChildren: boolean;
}

/**
 * Flattens the tree into the rows that are visible, depth-first: a collapsed
 * row's children are left out.
 */
export const listVisibleRows = (
  forest: readonly TreeRow[],
  collapsed: ReadonlySet<string>,
): VisibleRow[] => {
  const visit = (rows: readonly TreeRow[], level: number, parentId: string | null): VisibleRow[] =>
    rows.flatMap(({ node, children }, index) => [
      {
        node,
        level,
        positionInSet: index + 1,
        setSize: rows.length,
        parentId,
        hasChildren: children.length > 0,
      },
      ...(collapsed.has(node.id) ? [] : visit(children, level + 1, node.id)),
    ]);

  return visit(forest, 1, null);
};
