import { MAXIMUM_SPEC_WORDS } from "./constants";
import type { ConceptFact, RankedConcept } from "./types";

/** A value set apart from spacing and case: what two entities must differ in to be told apart. */
const squash = (value: string): string => value.toLowerCase().replaceAll(/\s+/gu, " ").trim();

/** The commonest value of a concept's facts; the earlier of two equally common wins. */
const readCommonest = (facts: readonly ConceptFact[]): string =>
  [...Map.groupBy(facts, ({ value }) => squash(value)).entries()].toSorted(
    ([, a], [, b]) => b.length - a.length,
  )[0]?.[0] ?? "";

/**
 * Ranks the concepts of some facts by how comparable they are, from the facts
 * alone — no list of products, attributes or languages: the concept that more
 * different entities state first, then the one more pages state, then the one
 * whose commonest value is shorter (a spec is short), then by key.
 *
 * A concept is informative unless its commonest value is prose (more than
 * {@link MAXIMUM_SPEC_WORDS} words), or two or more entities state it all with
 * the same value (it does not tell them apart). It is also a spec (`isSpec`)
 * unless, with several entities in all, only one states it.
 */
export const rankConcepts = (facts: readonly ConceptFact[]): RankedConcept[] => {
  const entityTotal = new Set(facts.map(({ entityId }) => entityId)).size;

  return [...Map.groupBy(facts, ({ key }) => key).entries()]
    .map(([key, members]) => {
      const entityCount = new Set(members.map(({ entityId }) => entityId)).size;
      const commonest = readCommonest(members);
      const isProse = commonest.split(/\s+/u).filter(Boolean).length > MAXIMUM_SPEC_WORDS;
      const isUniform =
        entityCount > 1 && new Set(members.map(({ value }) => squash(value))).size === 1;

      return {
        key,
        entityCount,
        pageCount: new Set(members.map(({ pageId }) => pageId)).size,
        length: commonest.length,
        isInformative: !isProse && !isUniform,
      };
    })
    .toSorted(
      (a, b) =>
        b.entityCount - a.entityCount ||
        b.pageCount - a.pageCount ||
        a.length - b.length ||
        a.key.localeCompare(b.key),
    )
    .map(({ key, entityCount, pageCount, isInformative }) => ({
      key,
      entityCount,
      pageCount,
      isInformative,
      isSpec: isInformative && (entityTotal < 2 || entityCount > 1),
    }));
};
