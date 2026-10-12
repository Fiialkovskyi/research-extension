/**
 * Every engagement state a node can be in, in the order a page usually moves
 * through them. A value rather than only a type, because the map's message
 * schema needs the closed set.
 */
export const ENGAGEMENT_STATES = ["unread", "skimmed", "deep_read", "dead_end"] as const;

/**
 * The rule set that derives a node's engagement from its signals
 * (target spec §4, "Engagement states").
 *
 * Versioned because the state is derived, never stored: a change here
 * re-labels every node at once, and anything that records a decision taken on
 * a state — such as a snapshot — can say which rules took it.
 *
 * The target table's "return to the SERP within 10 s" dead-end clause is not
 * part of this version: it needs the SERP a page was reached from and when
 * focus went back to it, which nothing records yet.
 */
export const ENGAGEMENT_RULES = {
  version: "engagement_rules@1",
  /** Deep read by reading: at least this much active dwell… */
  deepReadDwellMs: 45_000,
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
  /** Without input for this long, the user is idle and dwell stops counting. */
  idleThresholdSeconds: 60,
  /**
   * The most one uninterrupted stretch of dwell may add. Bounds the damage of
   * an event the browser never sent, such as sleep without an idle report.
   */
  maximumIntervalMs: 600_000,
} as const;
