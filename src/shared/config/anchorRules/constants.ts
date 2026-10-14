/**
 * The rule set that makes a page an anchor: a page the user kept coming back
 * to, took from or wrote into, which the map's anchor view draws as the
 * session's hubs (the target spec's research map, "Anchor view").
 *
 * Versioned like the engagement rules: anchors are derived, never stored, so a
 * change here re-draws every session at once. A page needs to meet one rule.
 */
export const ANCHOR_RULES = {
  version: "anchor_rules@1",
  /** Returned to at least this many times, each return counted as a revisit… */
  minimumRevisits: 2,
  /** …or copied from and pasted into at least this many times together… */
  minimumMarks: 2,
  /** …or read for at least this long in all. */
  minimumDwellMs: 180_000,
} as const;
