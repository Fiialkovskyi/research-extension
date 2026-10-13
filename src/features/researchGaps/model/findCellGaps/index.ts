import type { ComparisonTable } from "@/features/comparisonTable";

import { MAXIMUM_CELL_GAPS } from "../../constants";

/** An empty cell of a confirmed entity: which entity, which attribute. */
export interface CellGap {
  entity: string;
  attribute: string;
}

/**
 * Finds the table's empty cells of confirmed entities (REQ-SYN-008): rows
 * whose facts come from at least two pages, counted from their cells'
 * sources. In row, then column order; the first {@link MAXIMUM_CELL_GAPS},
 * and how many more there are.
 */
export const findCellGaps = (
  table: Pick<ComparisonTable, "columns" | "rows">,
): { gaps: CellGap[]; moreCount: number } => {
  const gaps = table.rows.flatMap((row) => {
    const pages = new Set(
      Object.values(row.cells).flatMap((cell) =>
        cell.groups.flatMap(({ sources }) => sources.map(({ url }) => url)),
      ),
    );

    return pages.size < 2
      ? []
      : table.columns
          .filter(({ key }) => row.cells[key] === undefined)
          .map(({ label }) => ({ entity: row.name, attribute: label }));
  });

  return {
    gaps: gaps.slice(0, MAXIMUM_CELL_GAPS),
    moreCount: Math.max(0, gaps.length - MAXIMUM_CELL_GAPS),
  };
};
