import { normalizeEntityName } from "@/shared/normalizeEntityName";

import { GENERIC_ATTRIBUTES, MAXIMUM_PROPOSED_COLUMNS } from "../../constants";
import type { ComparisonColumn, TableFact } from "../../types";

/** A column as the table shows it: its key and label. */
const asColumn = ({ key, label }: { key: string; label: string }): ComparisonColumn => ({
  key,
  label,
});

/**
 * Chooses a table's columns (REQ-SYN-005): the attributes of its facts, by
 * normalised key, ranked by how many rows have them, then alphabetically —
 * the first {@link MAXIMUM_PROPOSED_COLUMNS}, unless the user saved columns,
 * which are shown in their order, dropping any no fact has now. Each column's
 * label is its most frequent spelling. Attributes that say nothing — generic
 * ones such as a description, and, in a table of several rows, ones only one
 * row has — are not proposed; they stay among the other columns.
 *
 * @returns The columns shown, and the type's other attributes.
 */
export const proposeColumns = (
  facts: readonly TableFact[],
  saved?: readonly string[],
): { columns: ComparisonColumn[]; otherColumns: ComparisonColumn[] } => {
  const byKey = Map.groupBy(facts, ({ attributeKey }) => attributeKey);
  const all = [...byKey.entries()]
    .map(([key, members]) => {
      const spellings = Map.groupBy(members, ({ attribute }) => attribute.trim());
      const [label = key] =
        [...spellings.entries()].toSorted(
          ([a, x], [b, y]) => y.length - x.length || a.localeCompare(b),
        )[0] ?? [];

      return { key, label, rowCount: new Set(members.map(({ rowId }) => rowId)).size };
    })
    .toSorted((a, b) => b.rowCount - a.rowCount || a.key.localeCompare(b.key));
  const rowTotal = new Set(facts.map(({ rowId }) => rowId)).size;
  const generic = new Set(GENERIC_ATTRIBUTES.map((attribute) => normalizeEntityName(attribute)));
  const isInformative = ({ key, rowCount }: { key: string; rowCount: number }): boolean =>
    !generic.has(key) && (rowTotal < 2 || rowCount > 1);
  const shownKeys =
    saved === undefined || saved.length === 0
      ? all
          .filter(isInformative)
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
