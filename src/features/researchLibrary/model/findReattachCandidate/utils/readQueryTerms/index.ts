import { QUERY_STOP_WORDS } from "../../../../constants";

/**
 * The terms a search query is about: lowercased, split on whitespace and
 * punctuation — except a hyphen between letters or digits, so `e-bike` stays
 * one term — without single characters and common stop words.
 */
export const readQueryTerms = (query: string): Set<string> =>
  new Set(
    query
      .toLowerCase()
      .split(/[^\p{L}\p{N}-]+|(?<![\p{L}\p{N}])-|-(?![\p{L}\p{N}])/u)
      .filter((term) => term.length > 1 && !QUERY_STOP_WORDS.has(term)),
  );
