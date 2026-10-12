/**
 * The form two queries are compared in: lowercase, with runs of whitespace
 * collapsed. Not locale-aware, so the result does not depend on the browser's
 * language.
 */
export const normalizeQuery = (query: string): string =>
  query.trim().replaceAll(/\s+/g, " ").toLowerCase();
