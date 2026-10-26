import type { IDBPDatabase } from "idb";

import type { TabGroupApi } from "@/features/tabGroups";
import type { ResearchDatabaseSchema, StoredSession } from "@/shared/storage";

import { closeSessionForGroup } from "../closeSessionForGroup";
import { listLiveSessions } from "../listLiveSessions";
import { renameSessionForGroup } from "../renameSessionForGroup";
import { reopenSessionForGroup } from "../reopenSessionForGroup";

export interface ReconcileSessionsOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  /** Looks a group up by id; rejects when no such group exists. */
  getGroup: TabGroupApi["getGroup"];
}

/**
 * Brings every recorded session in line with the browser, and returns the live
 * sessions as they are afterwards (active first, then closed).
 *
 * The groups can change while nothing is listening: a window closed without a
 * restart, a group restored before the background woke, or the extension
 * disabled while the user renamed a group. So the records are checked against
 * the browser whenever the answer matters — at start-up and when a surface
 * asks. Each session is reconciled on its own group:
 *
 * - An active session whose group no longer exists is closed, not ended: the
 *   group may still be restored.
 * - A closed session whose group exists again is reopened.
 * - A title changed meanwhile is taken over.
 */
export const reconcileSessions = async ({
  database,
  getGroup,
}: ReconcileSessionsOptions): Promise<StoredSession[]> => {
  const live = await listLiveSessions(database);

  await Promise.all(
    live.map(async (session) => {
      let group;

      try {
        group = await getGroup(session.groupId);
      } catch {
        // Firefox rejects a lookup for a group that does not exist, and that
        // is the only thing a rejection here can mean for the session.
        await closeSessionForGroup(database, session.groupId);
        return;
      }

      const active = (await reopenSessionForGroup(database, session.groupId)) ?? session;

      if (group.title !== undefined) {
        await renameSessionForGroup(database, active.groupId, group.title);
      }
    }),
  );

  return listLiveSessions(database);
};
