import { normalizeEntityName } from "@/shared/normalizeEntityName";

import type { Labels } from "../../types";

/** How the table's columns treated the concept pairs the labels name. */
export interface MergeScore {
  /** Pairs that should share a column and had both concepts in the run. */
  sameTotal: number;
  /** Of those, the pairs that did. */
  sameMerged: number;
  /** Pairs that should stay apart and had both concepts in the run. */
  differentTotal: number;
  /** Of those, the pairs that did. */
  differentApart: number;
}

/**
 * Scores the column keys the run gave concepts against the labels' pairs. A
 * pair counts only when both of its concepts occurred in the run: a pair the
 * model never produced says nothing about merging.
 *
 * @param keys Each concept the run produced, to its column key.
 */
export const scoreMerges = (
  keys: ReadonlyMap<string, string>,
  { sameConcept, differentConcept }: Pick<Labels, "sameConcept" | "differentConcept">,
): MergeScore => {
  const byName = new Map([...keys].map(([concept, key]) => [normalizeEntityName(concept), key]));
  const readPair = ([first, second]: readonly [string, string]): [string, string] | undefined => {
    const a = byName.get(normalizeEntityName(first));
    const b = byName.get(normalizeEntityName(second));

    return a === undefined || b === undefined ? undefined : [a, b];
  };
  const same = sameConcept.map(readPair).filter((pair) => pair !== undefined);
  const different = differentConcept.map(readPair).filter((pair) => pair !== undefined);

  return {
    sameTotal: same.length,
    sameMerged: same.filter(([a, b]) => a === b).length,
    differentTotal: different.length,
    differentApart: different.filter(([a, b]) => a !== b).length,
  };
};
