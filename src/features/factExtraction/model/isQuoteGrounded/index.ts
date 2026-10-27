/** Collapses every run of whitespace to one space and trims the ends. */
const collapseWhitespace = (text: string): string => text.replaceAll(/\s+/gu, " ").trim();

/**
 * Whether a fact's quote is on the page (REQ-SYN-002): it occurs in the chunk
 * it was extracted from, as written or once runs of whitespace are collapsed
 * on both sides. Case and every other character must match; an empty quote
 * grounds nothing. `also` are other texts the page states about itself, its
 * product name and its title, where a size or a colour is often written once.
 */
export const isQuoteGrounded = (
  quote: string,
  chunk: string,
  also: readonly (string | undefined)[] = [],
): boolean => {
  const collapsed = collapseWhitespace(quote);

  if (collapsed.length === 0) {
    return false;
  }

  return [chunk, ...also].some(
    (text) =>
      text !== undefined && (text.includes(quote) || collapseWhitespace(text).includes(collapsed)),
  );
};
