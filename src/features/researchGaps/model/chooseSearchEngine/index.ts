import { readSearchEngine } from "@/features/tabCapture";
import { SEARCH_ENGINES, type SearchEngine } from "@/shared/config";

import { DEFAULT_SEARCH_ENGINE } from "../../constants";

/**
 * Picks the engine a gap's search uses: the one the session's own searches
 * used most, so the user stays where they search; DuckDuckGo when there were
 * none.
 *
 * @param serpUrls The URLs of the session's results pages.
 */
export const chooseSearchEngine = (serpUrls: readonly string[]): SearchEngine => {
  const counts = Map.groupBy(
    serpUrls.flatMap((url) => readSearchEngine(url) ?? []),
    ({ name }) => name,
  );
  const [mostUsed] = [...counts.values()].toSorted((a, b) => b.length - a.length);

  return mostUsed?.[0] ?? SEARCH_ENGINES.find(({ name }) => name === DEFAULT_SEARCH_ENGINE)!;
};
