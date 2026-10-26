import type { IDBPDatabase } from "idb";

import {
  NODE_STORE,
  type ResearchDatabaseSchema,
  type StoredNode,
  type StoredSession,
} from "@/shared/storage";

import { getSessionForGroup } from "../getSessionForGroup";
import { listLiveSessions } from "../listLiveSessions";

export interface SessionTabReference {
  tabId: number;
  /** The tab's group, or `-1` when it is in none (or no longer exists). */
  groupId: number;
}

/**
 * Finds the active session a tab belongs to: the one whose group holds it, and
 * for a tab that is in no group any more — a removal, or one dragged out —
 * the one that still has an open page for it.
 *
 * Only an active session answers. A closed one has lost its group, so nothing
 * is recorded into it, and its pages stay open on tabs that are gone until it
 * is resumed; tab ids are reused, so matching them would mistake a new tab for
 * one of those.
 */
export const getSessionForTab = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  { tabId, groupId }: SessionTabReference,
): Promise<StoredSession | undefined> => {
  const byGroup = await getSessionForGroup(database, groupId);

  if (byGroup !== undefined) {
    return byGroup.status === "active" ? byGroup : undefined;
  }

  const active = (await listLiveSessions(database)).filter(({ status }) => status === "active");

  for (const session of active) {
    const nodes: StoredNode[] = await database.getAllFromIndex(
      NODE_STORE,
      "sessionTab",
      IDBKeyRange.only([session.id, tabId]),
    );

    if (nodes.some(({ tabState }) => tabState === "open")) {
      return session;
    }
  }

  return undefined;
};
