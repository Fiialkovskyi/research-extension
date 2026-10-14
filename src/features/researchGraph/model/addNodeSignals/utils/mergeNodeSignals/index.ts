import type { StoredNode } from "@/shared/storage";

import type { SignalObservation } from "../../../../types";

/** Keeps the larger of two optional readings. */
const getLater = (stored: number | undefined, observed: number | undefined) => {
  if (observed === undefined) {
    return stored;
  }

  return stored === undefined ? observed : Math.max(stored, observed);
};

/**
 * Folds an observation into a node: dwell and counts add up, scroll depth and
 * last focus time keep their largest value.
 */
export const mergeNodeSignals = (node: StoredNode, observation: SignalObservation): StoredNode => {
  const { signals } = node;
  const lastFocusedAt = getLater(node.lastFocusedAt, observation.lastFocusedAt);

  return {
    ...node,
    signals: {
      activeDwellMs: signals.activeDwellMs + (observation.activeDwellMs ?? 0),
      maxScroll: Math.max(signals.maxScroll, observation.maxScroll ?? 0),
      copyEvents: signals.copyEvents + (observation.copyEvents ?? 0),
      pasteEvents: signals.pasteEvents + (observation.pasteEvents ?? 0),
      focusCount: signals.focusCount + (observation.focusCount ?? 0),
      revisitCount: signals.revisitCount + (observation.revisitCount ?? 0),
      quickReturnCount: signals.quickReturnCount + (observation.quickReturnCount ?? 0),
    },
    ...(lastFocusedAt === undefined ? {} : { lastFocusedAt }),
  };
};
