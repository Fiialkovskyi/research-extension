/** Collapses every run of whitespace to one space and trims the ends. */
const collapseWhitespace = (text: string): string => text.replaceAll(/\s+/gu, " ").trim();

/**
 * Whether a fact's quote is on the page (REQ-SYN-002): it occurs in the chunk
 * it was extracted from, as written or once runs of whitespace are collapsed
 * on both sides. Case and every other character must match; an empty quote
 * grounds nothing.
 */
export const isQuoteGrounded = (quote: string, chunk: string): boolean => {
  const collapsed = collapseWhitespace(quote);

  if (collapsed.length === 0) {
    return false;
  }

  return chunk.includes(quote) || collapseWhitespace(chunk).includes(collapsed);
};
