import type { ComparisonCell, TableFact, ValueGroup } from "../../types";
import { isSameValue } from "../isSameValue";

/** A value as the cell writes it: the number or text, then its unit. */
const writeValue = ({ value, unit }: Pick<TableFact, "value" | "unit">): string =>
  unit === undefined || unit.trim() === "" ? value : `${value} ${unit}`;

/** How many pages a group of facts comes from. */
const countPages = (group: readonly TableFact[]): number =>
  new Set(group.map(({ nodeId }) => nodeId)).size;

/**
 * The group whose newest dated source is strictly later than every other
 * group's, in a conflict; none when fewer than two groups have a dated source
 * or the newest dates tie. Only a hint for the reader: nothing is ranked by it.
 */
const findNewestGroup = (
  groups: readonly (readonly TableFact[])[],
): readonly TableFact[] | undefined => {
  const dated = groups.flatMap((group) => {
    const times = group.flatMap(({ publishedTime }) => publishedTime ?? []);

    return times.length === 0 ? [] : [{ group, time: Math.max(...times) }];
  });
  const [newest, next] = dated.toSorted((a, b) => b.time - a.time);

  return newest !== undefined && next !== undefined && newest.time > next.time
    ? newest.group
    : undefined;
};

/**
 * Builds one cell from a row's facts for one column (REQ-SYN-006).
 *
 * Facts are grouped greedily, in id order: each joins the first group whose
 * first value it agrees with — the first, not the last, so a chain of values
 * each within tolerance of the next cannot drift. The group with the most
 * facts is chosen, then the one from more pages, then the earlier. More than
 * one group is a conflict.
 */
export const buildCell = (facts: readonly TableFact[]): ComparisonCell => {
  const groups: TableFact[][] = [];

  for (const fact of facts.toSorted((a, b) => a.id.localeCompare(b.id))) {
    const group = groups.find(([first]) => first !== undefined && isSameValue(first, fact));

    if (group === undefined) {
      groups.push([fact]);
    } else {
      group.push(fact);
    }
  }

  const ranked = groups
    .map((group, order) => ({ group, order }))
    .toSorted(
      (a, b) =>
        b.group.length - a.group.length ||
        countPages(b.group) - countPages(a.group) ||
        a.order - b.order,
    )
    .map(({ group }) => group);
  const newest = findNewestGroup(ranked);
  const asValueGroup = (group: readonly TableFact[]): ValueGroup => ({
    value: writeValue(group[0]!),
    sources: group.map(({ id, pageTitle, url, quote, siteName, publishedDate }) => ({
      factId: id,
      pageTitle,
      url,
      quote,
      ...(siteName === undefined ? {} : { siteName }),
      ...(publishedDate === undefined ? {} : { publishedDate }),
    })),
    ...(group === newest ? { isNewest: true } : {}),
  });

  return {
    value: ranked[0] === undefined ? "" : writeValue(ranked[0][0]!),
    alternativeCount: Math.max(0, ranked.length - 1),
    isConflict: ranked.length > 1,
    groups: ranked.map(asValueGroup),
  };
};
