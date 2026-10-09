/**
 * The colours Firefox offers a tab group, in the order its own picker lists them.
 *
 * A closed set rather than a string: the extension never chooses a colour, but
 * it reads back the one Firefox assigned, and a value outside this set would
 * mean the platform changed underneath us.
 */
export const TAB_GROUP_COLORS = [
  "blue",
  "purple",
  "cyan",
  "orange",
  "yellow",
  "pink",
  "green",
  "grey",
  "red",
] as const;

/**
 * Longest title a session may be given.
 *
 * Firefox truncates a long label on screen anyway; the cap exists so an
 * untrusted message cannot hand the browser an unbounded string.
 */
export const TAB_GROUP_TITLE_MAX_LENGTH = 120;
