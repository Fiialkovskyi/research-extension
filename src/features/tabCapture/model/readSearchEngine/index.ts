import { SEARCH_ENGINES, type SearchEngine } from "@/shared/config";

import { isEngineHost } from "../isEngineHost";

/**
 * Reads which bundled search engine a URL is a results page of, by its
 * hostname and pathname only.
 *
 * @returns The engine, or `undefined` when the URL is not a results page.
 */
export const readSearchEngine = (url: string): SearchEngine | undefined => {
  if (!URL.canParse(url)) {
    return undefined;
  }

  const { hostname, pathname } = new URL(url);

  return SEARCH_ENGINES.find(
    (candidate) =>
      candidate.hosts.some((host) => isEngineHost(hostname, host)) &&
      candidate.resultPaths.includes(pathname),
  );
};
