/**
 * Whether two URLs name the same page. A fragment is a place on a page, and
 * capture records no node for moving to one, so it is ignored.
 */
export const isSamePage = (first: string, second: string): boolean =>
  first.split("#")[0] === second.split("#")[0];
