import type { IDBPDatabase } from "idb";

import { addNodeSignals } from "@/features/researchGraph";
import { ENGAGEMENT_RULES } from "@/shared/config";
import {
  NODE_STORE,
  type ResearchDatabaseSchema,
  type StoredFocusVisit,
  type StoredNode,
} from "@/shared/storage";

/** Whether the node with this id is a search result page. */
const isSerp = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  nodeId: string | null,
): Promise<boolean> => nodeId !== null && (await database.get(NODE_STORE, nodeId))?.kind === "serp";

/**
 * Counts a quick return: a page reached from a search, left on its first visit
 * for a search before the quick-return threshold of active dwell
 * (`engagement_rules@2`). Going back in the same tab and switching to the
 * search's tab both arrive here, as focus moving to a search node.
 *
 * Measured in active dwell rather than wall time: time in another application
 * does not count against the page.
 *
 * @param ended The visit that just ended, its dwell already brought up to date.
 * @param target The node focus moved to.
 * @returns Whether a quick return was counted.
 */
export const countQuickReturn = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  ended: StoredFocusVisit,
  target: StoredNode,
): Promise<boolean> => {
  if (
    target.kind !== "serp" ||
    ended.isRevisit ||
    ended.visitDwellMs >= ENGAGEMENT_RULES.quickReturnMs
  ) {
    return false;
  }

  const left = await database.get(NODE_STORE, ended.nodeId);

  if (
    left?.kind !== "page" ||
    !((await isSerp(database, left.parentNodeId)) || (await isSerp(database, left.openerNodeId)))
  ) {
    return false;
  }

  await addNodeSignals(database, left.id, { quickReturnCount: 1 });

  return true;
};
