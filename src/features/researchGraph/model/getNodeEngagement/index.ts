import { ENGAGEMENT_RULES, type ENGAGEMENT_STATES } from "@/shared/config";
import type { StoredNode } from "@/shared/storage";

/** How engaged the user was with a page, by `engagement_rules@1`. */
export type EngagementState = (typeof ENGAGEMENT_STATES)[number];

export interface EngagementContext {
  /**
   * Whether the node is the one the user is on now. A page looked at for three
   * seconds so far is not yet a dead end; it becomes one once it is left.
   */
  isFocused: boolean;
}

/**
 * Derives a node's engagement state from its signals.
 *
 * Never stored: the rules are versioned, and deriving the state where it is
 * read means a change of rules needs no rewrite of the graph.
 */
export const getNodeEngagement = (
  node: Pick<StoredNode, "signals">,
  { isFocused }: EngagementContext,
): EngagementState => {
  const { activeDwellMs, maxScroll, copyEvents, focusCount, revisitCount } = node.signals;

  if (focusCount === 0) {
    return "unread";
  }

  const isReadClosely =
    activeDwellMs >= ENGAGEMENT_RULES.deepReadDwellMs &&
    maxScroll >= ENGAGEMENT_RULES.deepReadScroll;

  if (isReadClosely || copyEvents > 0 || revisitCount >= ENGAGEMENT_RULES.deepReadRevisits) {
    return "deep_read";
  }

  if (
    !isFocused &&
    activeDwellMs < ENGAGEMENT_RULES.deadEndDwellMs &&
    maxScroll < ENGAGEMENT_RULES.deadEndScroll
  ) {
    return "dead_end";
  }

  return "skimmed";
};
