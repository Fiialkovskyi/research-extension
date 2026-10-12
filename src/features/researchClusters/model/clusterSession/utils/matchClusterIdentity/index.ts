import type { StoredCluster } from "@/shared/storage";

/**
 * Gives each new group of pages the id of the previous cluster it shares the
 * most pages with, so a cluster keeps its identity while its thread grows.
 *
 * Greedy, highest overlap first; each previous id is given at most once. Ties
 * go to the smaller previous id, then to the group whose first member sorts
 * first, so the outcome does not depend on input order. A group sharing no
 * page with any previous cluster gets a new id.
 *
 * @param groups Member ids of each new group.
 * @returns One id per group, in the groups' order.
 */
export const matchClusterIdentity = (
  groups: readonly (readonly string[])[],
  previous: readonly StoredCluster[],
  createId: () => string = () => crypto.randomUUID(),
): string[] => {
  const pairs = groups.flatMap((members, groupIndex) =>
    previous.flatMap((cluster) => {
      const shared = members.filter((member) => cluster.memberIds.includes(member)).length;

      return shared > 0 ? [{ groupIndex, previousId: cluster.id, shared }] : [];
    }),
  );
  const firstMember = (groupIndex: number) => groups[groupIndex]?.toSorted()[0] ?? "";

  pairs.sort(
    (first, second) =>
      second.shared - first.shared ||
      first.previousId.localeCompare(second.previousId) ||
      firstMember(first.groupIndex).localeCompare(firstMember(second.groupIndex)),
  );

  const ids: (string | undefined)[] = groups.map(() => undefined);
  const taken = new Set<string>();

  for (const { groupIndex, previousId } of pairs) {
    if (ids[groupIndex] === undefined && !taken.has(previousId)) {
      ids[groupIndex] = previousId;
      taken.add(previousId);
    }
  }

  return ids.map((id) => id ?? createId());
};
