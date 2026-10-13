import { getFactKey, type StatedFact } from "../getFactKey";

/**
 * Leaves out the facts whose key the user rejected (REQ-LIN-008). Facts are
 * kept in the store, so one extracted later by any model is left out the same
 * way, and restoring brings them back.
 */
export const filterRejectedFacts = async <Fact extends StatedFact>(
  facts: readonly Fact[],
  rejectedKeys: ReadonlySet<string>,
): Promise<Fact[]> => {
  if (rejectedKeys.size === 0) {
    return [...facts];
  }

  const kept = await Promise.all(
    facts.map(async (fact) => (rejectedKeys.has(await getFactKey(fact)) ? undefined : fact)),
  );

  return kept.flatMap((fact) => fact ?? []);
};
