import type { LabelledFact } from "../../types";
import { readValueTokens } from "../readValueTokens";

/** A fact as it is compared with a label: the value and unit the model gave. */
export interface ComparedFact {
  value: string;
  unit?: string | undefined;
}

/**
 * Whether a fact's value says what the label does. A label with numbers is
 * matched on its numbers alone (`5100` finds `5100 mAh` and `5100 мАг`), since
 * the unit and the words around it are worded differently by every page; a
 * label without numbers is matched on all its words.
 */
const isFound = (label: LabelledFact, facts: readonly ComparedFact[]): boolean => {
  const tokens = readValueTokens(label.value);
  const numbers = tokens.filter((token) => /\d/u.test(token));
  const needed = numbers.length > 0 ? numbers : tokens;

  return facts.some((fact) => {
    const present = new Set(readValueTokens(`${fact.value} ${fact.unit ?? ""}`));

    return needed.every((token) => present.has(token));
  });
};

/**
 * Sorts a page's labelled facts into those some extracted fact states and
 * those none does. The concept is not compared here: it is the model's wording,
 * and whether two wordings share a column is scored on its own.
 */
export const matchFacts = (
  labels: readonly LabelledFact[],
  facts: readonly ComparedFact[],
): { found: LabelledFact[]; missing: LabelledFact[] } => ({
  found: labels.filter((label) => isFound(label, facts)),
  missing: labels.filter((label) => !isFound(label, facts)),
});
