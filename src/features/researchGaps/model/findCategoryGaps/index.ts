import { GAP_CATEGORIES } from "../../constants";
import type { GapCategory } from "../../types";
import { readDomainCategory } from "../readDomainCategory";

/**
 * Finds the kinds of source the session has not read (REQ-SYN-008): the gap
 * categories none of its pages falls into. Results pages are not sources.
 *
 * @param pageUrls The URLs of the session's pages, without its searches.
 */
export const findCategoryGaps = (pageUrls: readonly string[]): GapCategory[] => {
  const visited = new Set(
    pageUrls.flatMap((url) =>
      URL.canParse(url) ? [readDomainCategory(new URL(url).hostname)] : [],
    ),
  );

  return GAP_CATEGORIES.filter((category) => !visited.has(category));
};
