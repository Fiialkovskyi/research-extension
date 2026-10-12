import type { StoredNode } from "@/shared/storage";

/**
 * Names a cluster by its earliest search's query, or else by its earliest
 * page's title, or its URL when the page reported no title.
 *
 * @param members The cluster's pages, earliest first.
 */
export const readClusterLabel = (members: readonly StoredNode[]): string => {
  const search = members.find((node) => node.kind === "serp" && node.query !== undefined);

  if (search?.query !== undefined) {
    return search.query;
  }

  const [first] = members;

  if (first === undefined) {
    return "";
  }

  return first.title.trim() === "" ? first.url : first.title;
};
