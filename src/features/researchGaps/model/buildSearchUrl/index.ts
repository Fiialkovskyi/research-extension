import type { SearchEngine } from "@/shared/config";

/** Builds an engine's results URL for a query, the query encoded. */
export const buildSearchUrl = (engine: Pick<SearchEngine, "searchUrl">, query: string): string =>
  engine.searchUrl.replace("{query}", encodeURIComponent(query));
