import { normalizeEntityName } from "@/shared/normalizeEntityName";

import type { ExtractedFact } from "../../types";
import { repairSubject } from "../repairSubject";
import { isLabelValue } from "./utils/isLabelValue";
import { stripRepeatedUnit } from "./utils/stripRepeatedUnit";

/**
 * Cleans the facts of one answer after their quotes are checked, for slips a small model makes that
 * the quote cannot show: a fact whose value is only another fact's label is dropped; one whose value
 * is its own attribute is a bare value the model took for a label (`S10`, `Starlight`) when it is one
 * word, and then its attribute becomes the concept, and a feature named without a value when it is
 * more, and then it is dropped; a subject the model garbled is
 * given the page's product name (`repairSubject`); a unit written both in `value` and in `unit` is
 * kept once. The quote is left as it is, since it is evidence.
 *
 * @returns The facts that remain, and how many were dropped.
 */
export const tidyFacts = (
  facts: readonly ExtractedFact[],
  productName: string | undefined,
): { facts: ExtractedFact[]; droppedCount: number } => {
  const counts = Map.groupBy(facts, ({ attribute }) => normalizeEntityName(attribute));
  const kept = facts.flatMap((fact) => {
    const own = normalizeEntityName(fact.attribute);
    const isNamedValue = normalizeEntityName(fact.value) === own;

    // A value that is only a label of another fact of the answer, or a feature named with no value.
    if (
      isLabelValue(
        fact,
        (attribute) => (counts.get(attribute)?.length ?? 0) > Number(attribute === own),
      ) ||
      (isNamedValue && own.split(" ").length > 1)
    ) {
      return [];
    }

    const { value, unit } = stripRepeatedUnit(fact);
    const { unit: _unit, ...rest } = fact;

    return [
      {
        ...rest,
        // A bare value the model took for its own label is the value of what the concept names.
        attribute: isNamedValue ? fact.concept : fact.attribute,
        subject: repairSubject(fact.subject, productName),
        value,
        ...(unit === undefined ? {} : { unit }),
      },
    ];
  });

  return { facts: kept, droppedCount: facts.length - kept.length };
};
