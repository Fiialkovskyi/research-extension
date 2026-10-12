import { SEARCH_ENGINES } from "@/shared/config";

import { isEngineHost } from "./utils/isEngineHost";

/**
 * Reads the search query from a search engine's results URL.
 *
 * Only the URL is read, never the page. The scheme and port are ignored; the
 * hostname and pathname decide whether the page is a results page at all.
 *
 * @returns The query with surrounding whitespace removed, or `undefined` when
 *   the URL is not a results page of a bundled engine or carries no query.
 */
export const readSearchQuery = (url: string): string | undefined => {
  if (!URL.canParse(url)) {
    return undefined;
  }

  const { hostname, pathname, searchParams } = new URL(url);
  const engine = SEARCH_ENGINES.find(
    (candidate) =>
      candidate.hosts.some((host) => isEngineHost(hostname, host)) &&
      candidate.resultPaths.includes(pathname),
  );

  for (const parameter of engine?.queryParameters ?? []) {
    const query = searchParams.get(parameter)?.trim();

    if (query !== undefined && query !== "") {
      return query;
    }
  }

  return undefined;
};
