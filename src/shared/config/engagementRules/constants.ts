/**
 * Every engagement state a node can be in, in the order a page usually moves
 * through them. A value rather than only a type, because the map's message
 * schema needs the closed set.
 */
export const ENGAGEMENT_STATES = ["unread", "skimmed", "deep_read", "dead_end"] as const;

/**
 * The rule set that derives a node's engagement from its signals, and the
 * focus thresholds capture applies
 * (target spec §4, "Engagement states").
 *
 * Versioned because the state is derived, never stored: a change here
 * re-labels every node at once, and anything that records a decision taken on
 * a state — such as a snapshot — can say which rules took it.
 *
 * Version 3 lowers the dwell that makes a page deep read from 45 s to 30 s.
 *
 * Version 2 adds the target table's quick return to the search to the dead
 * end, and the co-attention thresholds capture links pages by.
 */
export const ENGAGEMENT_RULES = {
  version: "engagement_rules@3",
  /** Deep read by reading: at least this much active dwell… */
  deepReadDwellMs: 30_000,
  /** …together with at least this much of the page scrolled into view. */
  deepReadScroll: 0.4,
  /** Deep read by coming back: this many revisits, each of `revisitDwellMs` or more. */
  deepReadRevisits: 2,
  /** A return to a page counts as a revisit once it has lasted this long. */
  revisitDwellMs: 20_000,
  /** Dead end: left after less dwell than this… */
  deadEndDwellMs: 8_000,
  /** …and less of the page scrolled into view than this. */
  deadEndScroll: 0.15,
  /**
   * Dead end by leaving: a first visit to a page reached from a search that
   * goes back to a search before this much active dwell.
   */
  quickReturnMs: 10_000,
  /** Co-attention: this many moves between the same two pages… */
  coAttentionMoves: 3,
  /** …within this long. */
  coAttentionWindowMs: 300_000,
  /** The most recent moves the session keeps for counting co-attention. */
  maximumRecentSwitches: 50,
  /** Without input for this long, the user is idle and dwell stops counting. */
  idleThresholdSeconds: 60,
  /**
   * The most one uninterrupted stretch of dwell may add. Bounds the damage of
   * an event the browser never sent, such as sleep without an idle report.
   */
  maximumIntervalMs: 600_000,
} as const;
