import type { IDBPDatabase } from "idb";

import { readSessionRoot, recordEdge } from "@/features/researchGraph";
import type { ResearchDatabaseSchema, StoredNode } from "@/shared/storage";

import { CAPTURE_EDGE_WEIGHTS } from "../../constants";
import { normalizeQuery } from "./utils/normalizeQuery";

/**
 * Links a newly recorded SERP to the session's root when it refines it: a
 * search for a different query than the one the session started from
 * (REQ-CAP-003).
 *
 * The root is the session's earliest SERP, so the first search becomes the root
 * and links nothing. The node itself is left out of the choice: capture runs
 * one event at a time, so the node just recorded is the newest whatever its
 * timestamp, and a search recorded in the same millisecond as the root must
 * still link to it. A later page of the same results, or the same query on
 * another engine, is not a refinement either. Run on the capture queue right
 * after the node is recorded, so the root cannot change in between.
 */
export const linkRefinement = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  node: StoredNode,
): Promise<void> => {
  if (node.kind !== "serp" || node.query === undefined) {
    return;
  }

  const root = await readSessionRoot(database, node.sessionId, node.id);

  if (root === undefined || normalizeQuery(root.query ?? "") === normalizeQuery(node.query)) {
    return;
  }

  await recordEdge(database, {
    sessionId: node.sessionId,
    kind: "refinement",
    from: root.id,
    to: node.id,
    weight: CAPTURE_EDGE_WEIGHTS.refinement,
  });
};
