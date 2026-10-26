import { GAP_CATEGORIES, MINIMUM_CLASSIFIED_PAGES } from "../../constants";
import type { GapCategory } from "../../types";

/**
 * Finds the kinds of source the session has not read (REQ-SYN-008): the gap
 * categories none of its pages is of. A kind is reported only when the session
 * can tell: at least {@link MINIMUM_CLASSIFIED_PAGES} pages, at least half of
 * them classified; otherwise none, since a page that declares nothing may be of
 * any kind.
 *
 * @param kinds The kind of each of the session's pages, without its searches;
 *   `undefined` for a page that declares none.
 */
export const findCategoryGaps = (kinds: readonly (GapCategory | undefined)[]): GapCategory[] => {
  const classified = kinds.filter((kind) => kind !== undefined);

  if (kinds.length < MINIMUM_CLASSIFIED_PAGES || classified.length * 2 < kinds.length) {
    return [];
  }

  return GAP_CATEGORIES.filter((category) => !classified.includes(category));
};
