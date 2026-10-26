/** One page's citations: the first, which a line shows, and the others it gave. */
export interface PageCitations<T> {
  first: T;
  more: T[];
}

/**
 * Groups citations by the page they come from, in the order each page first
 * appears, so a page that gave several quotes is one line with the rest behind it.
 */
export const groupCitationsByPage = <T extends { url: string }>(
  citations: readonly T[],
): PageCitations<T>[] =>
  [...Map.groupBy(citations, ({ url }) => url).values()].flatMap(([first, ...more]) =>
    first === undefined ? [] : [{ first, more }],
  );
