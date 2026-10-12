import type { IDBPDatabase } from "idb";

import type { TabGroupApi } from "@/features/tabGroups";
import type { ResearchDatabaseSchema, StoredSession } from "@/shared/storage";

import { closeSessionForGroup } from "../closeSessionForGroup";
import { getLiveSession } from "../getLiveSession";
import { renameSessionForGroup } from "../renameSessionForGroup";
import { reopenSessionForGroup } from "../reopenSessionForGroup";

export interface ReconcileActiveSessionOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  /** Looks a group up by id; rejects when no such group exists. */
  getGroup: TabGroupApi["getGroup"];
}

/**
 * Brings the recorded session in line with the browser, and returns the
 * session that is active afterwards.
 *
 * The group can change while nothing is listening: a window closed without a
 * restart, a group restored before the background woke, or the extension
 * disabled while the user renamed the group. So the record is checked against
 * the browser whenever the answer matters — at start-up, before a new session
 * starts, and when a surface asks.
 *
 * - An active session whose group no longer exists is closed, not ended: the
 *   group may still be restored.
 * - A closed session whose group exists again is reopened.
 * - A title changed meanwhile is taken over.
 */
export const reconcileActiveSession = async ({
  database,
  getGroup,
}: ReconcileActiveSessionOptions): Promise<StoredSession | undefined> => {
  const live = await getLiveSession(database);

  if (live === undefined) {
    return undefined;
  }

  let group;

  try {
    group = await getGroup(live.groupId);
  } catch {
    // Firefox rejects a lookup for a group that does not exist, and that is
    // the only thing a rejection here can mean for the session.
    await closeSessionForGroup(database, live.groupId);
    return undefined;
  }

  const active = (await reopenSessionForGroup(database, live.groupId)) ?? live;

  if (group.title === undefined) {
    return active;
  }

  return (await renameSessionForGroup(database, active.groupId, group.title)) ?? active;
};
