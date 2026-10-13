import type { SummaryFact } from "../../types";

/**
 * Chooses at most `limit` facts for one summary, spread so that every group —
 * an entity, or a subject without one — and every page is represented before
 * any gets a second fact: groups biggest first, one fact each in turn, a page
 * not yet used within the group preferred.
 *
 * @returns The facts chosen, and how many were left out.
 */
export const selectSummaryFacts = (
  facts: readonly SummaryFact[],
  limit: number,
): { selected: SummaryFact[]; omittedCount: number } => {
  const groups = [...Map.groupBy(facts, ({ groupKey }) => groupKey).entries()]
    .toSorted(([nameA, a], [nameB, b]) => b.length - a.length || nameA.localeCompare(nameB))
    .map(([, members]) => {
      const usedPages = new Set<string>();
      const left = members.toSorted((a, b) => a.id.localeCompare(b.id));

      return () => {
        const index = Math.max(
          left.findIndex(({ nodeId }) => !usedPages.has(nodeId)),
          left.length > 0 ? 0 : -1,
        );
        const [next] = index === -1 ? [] : left.splice(index, 1);

        if (next !== undefined) {
          usedPages.add(next.nodeId);
        }

        return next;
      };
    });
  const selected: SummaryFact[] = [];

  while (selected.length < Math.min(limit, facts.length)) {
    for (const takeNext of groups) {
      const next = selected.length < limit ? takeNext() : undefined;

      if (next !== undefined) {
        selected.push(next);
      }
    }
  }

  return { selected, omittedCount: facts.length - selected.length };
};
