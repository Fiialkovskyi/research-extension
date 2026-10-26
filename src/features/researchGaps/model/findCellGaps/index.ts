import type { ComparisonTable } from "@/features/comparisonTable";

import { MAXIMUM_CELL_GAPS, MAXIMUM_GAP_ATTRIBUTES, MINIMUM_GAP_ROW_FACTS } from "../../constants";

/** What one entity lacks: the attributes it has no value for, and how many more it lacks. */
export interface CellGap {
  entity: string;
  /** The first {@link MAXIMUM_GAP_ATTRIBUTES} missing attributes, in column order. */
  attributes: string[];
  moreCount: number;
}

/**
 * Finds what the table's confirmed entities lack (REQ-SYN-008): rows with at
 * least {@link MINIMUM_GAP_ROW_FACTS} facts from at least two pages, counted
 * from their cells' sources, so a row seen thinly has no gaps. One gap for each
 * such row that misses a value of a column the table shows, in row order; the
 * first {@link MAXIMUM_CELL_GAPS}, and how many more rows there are.
 */
export const findCellGaps = (
  table: Pick<ComparisonTable, "columns" | "rows">,
): { gaps: CellGap[]; moreCount: number } => {
  const gaps = table.rows.flatMap((row): CellGap[] => {
    const sources = Object.values(row.cells).flatMap((cell) =>
      cell.groups.flatMap((group) => group.sources),
    );
    const isConfirmed =
      new Set(sources.map(({ factId }) => factId)).size >= MINIMUM_GAP_ROW_FACTS &&
      new Set(sources.map(({ url }) => url)).size >= 2;
    const missing = table.columns
      .filter(({ key }) => row.cells[key] === undefined)
      .map(({ label }) => label);

    return isConfirmed && missing.length > 0
      ? [
          {
            entity: row.name,
            attributes: missing.slice(0, MAXIMUM_GAP_ATTRIBUTES),
            moreCount: Math.max(0, missing.length - MAXIMUM_GAP_ATTRIBUTES),
          },
        ]
      : [];
  });

  return {
    gaps: gaps.slice(0, MAXIMUM_CELL_GAPS),
    moreCount: Math.max(0, gaps.length - MAXIMUM_CELL_GAPS),
  };
};
