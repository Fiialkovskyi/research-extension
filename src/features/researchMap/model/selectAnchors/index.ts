import { ANCHOR_RULES } from "@/shared/config";

import type { MapNode } from "../../types";

/** The signals the anchor rules read. */
export type AnchorSignals = Pick<
  MapNode,
  "id" | "revisitCount" | "copyEvents" | "pasteEvents" | "activeDwellMs"
>;

/**
 * Picks the session's anchors by `anchor_rules@1`: pages the user came back
 * to, took from or wrote into, or read for a long time. One rule is enough.
 */
export const selectAnchors = (nodes: readonly AnchorSignals[]): Set<string> =>
  new Set(
    nodes
      .filter(
        (node) =>
          node.revisitCount >= ANCHOR_RULES.minimumRevisits ||
          node.copyEvents + node.pasteEvents >= ANCHOR_RULES.minimumMarks ||
          node.activeDwellMs >= ANCHOR_RULES.minimumDwellMs,
      )
      .map(({ id }) => id),
  );
