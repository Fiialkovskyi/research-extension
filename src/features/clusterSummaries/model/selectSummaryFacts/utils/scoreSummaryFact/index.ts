import { CARD_HEADER_KEYS, KEY_SPEC_COUNT } from "../../../../constants";
import type { SummaryFact } from "../../../../types";

/**
 * How much a fact matters to a summary: 100 for the price from the page's own
 * product data, 60 down to 51 for one in a key spec — `place` is its concept's
 * place among the cluster's key specs (`readKeySpecPlaces`), the first
 * {@link KEY_SPEC_COUNT} count — 45 for the page's other data (brand,
 * availability, rating), which tells a chooser less than a spec does, 20 for
 * one that more than one page states, else 0.
 */
export const scoreSummaryFact = (
  fact: SummaryFact,
  isCorroborated: boolean,
  place: number | undefined,
): number => {
  if (fact.isPageData && fact.attributeKey === CARD_HEADER_KEYS[0]) {
    return 100;
  }

  if (place !== undefined && place < KEY_SPEC_COUNT) {
    return 60 - place;
  }

  if (fact.isPageData) {
    return 45;
  }

  return isCorroborated ? 20 : 0;
};
