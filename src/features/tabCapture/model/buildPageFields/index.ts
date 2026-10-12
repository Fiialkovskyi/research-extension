import type { NewNode } from "@/features/researchGraph";

import { readSearchQuery } from "../readSearchQuery";

/** What a node says about its page, as opposed to how it was reached. */
export type PageFields = Pick<NewNode, "kind" | "query" | "domain">;

/**
 * Classifies a captured page from its URL: a search engine's results page with
 * a query is a SERP carrying that query, anything else a plain page.
 *
 * Every path that records a node builds these fields here, so a page is
 * classified the same way whether it was navigated to, dragged into the group
 * or restored.
 */
export const buildPageFields = (url: string): PageFields => {
  const domain = new URL(url).hostname;
  const query = readSearchQuery(url);

  return query === undefined ? { kind: "page", domain } : { kind: "serp", query, domain };
};
