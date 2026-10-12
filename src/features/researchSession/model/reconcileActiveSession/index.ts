import type { IDBPDatabase } from "idb";

import type { TabGroupApi } from "@/features/tabGroups";
import type { ResearchDatabaseSchema, StoredSession } from "@/shared/storage";

import { endSessionForGroup } from "../endSessionForGroup";
import { getActiveSession } from "../getActiveSession";
import { renameSessionForGroup } from "../renameSessionForGroup";

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
 * restart, or the extension disabled while the user renamed the group. So the
 * record is checked against the browser whenever the answer matters — at
 * start-up, before a new session starts, and when a surface asks. A session
 * whose group no longer exists ends; a title changed meanwhile is taken over.
 */
export const reconcileActiveSession = async ({
  database,
  getGroup,
}: ReconcileActiveSessionOptions): Promise<StoredSession | undefined> => {
  const active = await getActiveSession(database);

  if (active === undefined) {
    return undefined;
  }

  let group;

  try {
    group = await getGroup(active.groupId);
  } catch {
    // Firefox rejects a lookup for a group that does not exist, and that is
    // the only thing a rejection here can mean for the session.
    await endSessionForGroup(database, active.groupId);
    return undefined;
  }

  if (group.title === undefined) {
    return active;
  }

  return (await renameSessionForGroup(database, active.groupId, group.title)) ?? active;
};
