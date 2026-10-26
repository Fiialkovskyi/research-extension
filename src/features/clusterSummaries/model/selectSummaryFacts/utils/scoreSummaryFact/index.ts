import { KEY_SPEC_ORDER } from "../../../../constants";
import type { SummaryFact } from "../../../../types";

/**
 * How much a fact matters to a summary: 100 for a fact from the page's own
 * product data, 60 down to 51 for one in a key spec, by its place in
 * {@link KEY_SPEC_ORDER}, 20 for one that more than one page states, else 0.
 */
export const scoreSummaryFact = (fact: SummaryFact, isCorroborated: boolean): number => {
  if (fact.isPageData) {
    return 100;
  }

  const place = (KEY_SPEC_ORDER as readonly string[]).indexOf(fact.attributeKey);

  if (place !== -1) {
    return 60 - place;
  }

  return isCorroborated ? 20 : 0;
};
