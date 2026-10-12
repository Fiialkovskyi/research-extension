import type { IDBPDatabase } from "idb";

import { recordEdge } from "@/features/researchGraph";
import { ENGAGEMENT_RULES } from "@/shared/config";
import type { ResearchDatabaseSchema, StoredFocusSwitch } from "@/shared/storage";

import { CAPTURE_EDGE_WEIGHTS } from "../../../../constants";

/** Whether two moves are between the same two nodes, in either direction. */
const isSamePair = (first: StoredFocusSwitch, second: StoredFocusSwitch): boolean =>
  (first.from === second.from && first.to === second.to) ||
  (first.from === second.to && first.to === second.from);

/**
 * Links two pages the user keeps moving between (REQ-CAP-007): once focus has
 * moved between the same two nodes enough times within the window, in either
 * direction, they get one `coAttention` edge.
 *
 * The edge runs from the smaller node id to the larger, so the pair has one key
 * whichever way it was flipped, and recording it again finds the first.
 *
 * @param switches The session's recent moves, the latest last and already
 *   pruned to the window.
 * @returns Whether the latest move's pair is linked.
 */
export const linkCoAttention = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
  switches: readonly StoredFocusSwitch[],
): Promise<boolean> => {
  const latest = switches.at(-1);

  if (latest === undefined) {
    return false;
  }

  const moves = switches.filter((move) => isSamePair(move, latest)).length;

  if (moves < ENGAGEMENT_RULES.coAttentionMoves) {
    return false;
  }

  const [from, to] = [latest.from, latest.to].toSorted();

  await recordEdge(database, {
    sessionId,
    kind: "coAttention",
    from: from as string,
    to: to as string,
    weight: CAPTURE_EDGE_WEIGHTS.coAttention,
  });

  return true;
};
