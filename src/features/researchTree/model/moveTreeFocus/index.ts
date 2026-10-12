import type { VisibleRow } from "../listVisibleRows";

/** The keys the WAI-ARIA tree pattern gives meaning to here. */
export type TreeKey = "ArrowDown" | "ArrowUp" | "ArrowRight" | "ArrowLeft" | "Home" | "End";

/** Where focus is, and which rows are collapsed. */
export interface TreeFocus {
  focusedId: string | undefined;
  collapsed: ReadonlySet<string>;
}

/**
 * Applies one key of the WAI-ARIA tree pattern: Down and Up move between
 * visible rows; Right expands a collapsed row or moves to its first child;
 * Left collapses an expanded row or moves to its parent; Home and End move to
 * the first and last visible row. Unknown focus starts at the first row.
 */
export const moveTreeFocus = (
  rows: readonly VisibleRow[],
  { focusedId, collapsed }: TreeFocus,
  key: TreeKey,
): TreeFocus => {
  const index = rows.findIndex(({ row }) => row.id === focusedId);
  const current = rows[index];
  const focusAt = (at: number): TreeFocus => ({
    focusedId: rows[Math.min(Math.max(at, 0), rows.length - 1)]?.row.id,
    collapsed,
  });

  if (current === undefined) {
    return focusAt(0);
  }

  switch (key) {
    case "ArrowDown":
      return focusAt(index + 1);
    case "ArrowUp":
      return focusAt(index - 1);
    case "Home":
      return focusAt(0);
    case "End":
      return focusAt(rows.length - 1);
    case "ArrowRight": {
      if (!current.hasChildren) {
        return { focusedId, collapsed };
      }

      if (collapsed.has(current.row.id)) {
        const expanded = new Set(collapsed);

        expanded.delete(current.row.id);

        return { focusedId, collapsed: expanded };
      }

      return focusAt(index + 1);
    }
    case "ArrowLeft": {
      if (current.hasChildren && !collapsed.has(current.row.id)) {
        return { focusedId, collapsed: new Set([...collapsed, current.row.id]) };
      }

      return { focusedId: current.parentId ?? focusedId, collapsed };
    }
  }
};
