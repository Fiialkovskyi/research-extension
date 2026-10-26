import { rankConcepts } from "@/shared/rankConcepts";

import { MAXIMUM_PROPOSED_COLUMNS } from "../../constants";
import type { ComparisonColumn, TableFact } from "../../types";

/** A column as the table shows it: its key and label. */
const asColumn = ({ key, label }: { key: string; label: string }): ComparisonColumn => ({
  key,
  label,
});

/**
 * Chooses a table's columns (REQ-SYN-005): the concepts of its facts, ranked by
 * how comparable they are (`rankConcepts`: more rows, then more pages, then a
 * shorter value) — the first {@link MAXIMUM_PROPOSED_COLUMNS}, unless the user
 * saved columns, which are shown in their order, dropping any no fact has now.
 * Each column's label is its most frequent spelling. Concepts that say nothing —
 * prose, ones every row states with the same value, and, in a table of several
 * rows, ones only one row has — are not proposed; they stay among the other
 * columns. The data decides this, not a list of attributes.
 *
 * @returns The columns shown, and the type's other attributes.
 */
export const proposeColumns = (
  facts: readonly TableFact[],
  saved?: readonly string[],
): { columns: ComparisonColumn[]; otherColumns: ComparisonColumn[] } => {
  const byKey = Map.groupBy(facts, ({ attributeKey }) => attributeKey);
  const ranked = rankConcepts(
    facts.map(({ attributeKey, rowId, nodeId, value, unit }) => ({
      key: attributeKey,
      entityId: rowId,
      pageId: nodeId,
      value: unit === undefined ? value : `${value} ${unit}`,
    })),
  );
  const all = ranked.map(({ key, isSpec }) => {
    const spellings = Map.groupBy(byKey.get(key) ?? [], ({ attribute }) => attribute.trim());
    const [label = key] =
      [...spellings.entries()].toSorted(
        ([a, x], [b, y]) => y.length - x.length || a.localeCompare(b),
      )[0] ?? [];

    return { key, label, isSpec };
  });
  const shownKeys =
    saved === undefined || saved.length === 0
      ? all
          .filter(({ isSpec }) => isSpec)
          .slice(0, MAXIMUM_PROPOSED_COLUMNS)
          .map(({ key }) => key)
      : saved.filter((key) => byKey.has(key));

  return {
    columns: shownKeys
      .flatMap((key) => all.find((column) => column.key === key) ?? [])
      .map(asColumn),
    otherColumns: all.filter(({ key }) => !shownKeys.includes(key)).map(asColumn),
  };
};
