import type { SummaryFact } from "../../../../types";
import { writeFactValue } from "../writeFactValue";

/**
 * Chooses the value most facts state, and the facts that state it: the first
 * stated (by fact id) wins a tie, and a fact from the page's own data counts
 * as the choice outright.
 *
 * @returns The value and its facts, or `undefined` without facts.
 */
export const pickValue = (
  facts: readonly SummaryFact[],
): { value: string; facts: SummaryFact[] } | undefined => {
  const ordered = facts.toSorted((a, b) => a.id.localeCompare(b.id));
  const pageData = ordered.find(({ isPageData }) => isPageData);
  const groups = Map.groupBy(ordered, writeFactValue);
  const [value, stating] =
    pageData === undefined
      ? ([...groups.entries()].toSorted(([, a], [, b]) => b.length - a.length)[0] ?? [])
      : [writeFactValue(pageData), groups.get(writeFactValue(pageData))];

  return value === undefined || stating === undefined
    ? undefined
    : {
        value,
        facts: stating.toSorted(
          (a, b) => Number(b.isPageData) - Number(a.isPageData) || a.id.localeCompare(b.id),
        ),
      };
};
