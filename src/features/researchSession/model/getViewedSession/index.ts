import type { IDBPDatabase } from "idb";

import type { ResearchDatabaseSchema, StoredSession } from "@/shared/storage";

import { getSessionForGroup } from "../getSessionForGroup";
import { listLiveSessions } from "../listLiveSessions";

/**
 * Finds the session the popup refers to: the active session chosen last, else
 * the active session whose group holds the selected tab (`selectedGroupId`),
 * else the active session recorded to most recently, else none.
 *
 * Only an active session can be viewed. One that was chosen and has since been
 * closed, saved or deleted is passed over, so the answer is always a session
 * that exists.
 */
export const getViewedSession = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  selectedGroupId?: number,
): Promise<StoredSession | undefined> => {
  const active = (await listLiveSessions(database)).filter(({ status }) => status === "active");
  const chosen = active
    .filter(({ viewedAt }) => viewedAt !== undefined)
    .toSorted((a, b) => (b.viewedAt ?? 0) - (a.viewedAt ?? 0))[0];

  if (chosen !== undefined) {
    return chosen;
  }

  const selected =
    selectedGroupId === undefined ? undefined : await getSessionForGroup(database, selectedGroupId);

  if (selected?.status === "active") {
    return selected;
  }

  return active.toSorted((a, b) => b.updatedAt - a.updatedAt)[0];
};
