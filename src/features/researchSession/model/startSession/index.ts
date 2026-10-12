import type { IDBPDatabase } from "idb";

import { type CreatedTabGroup, createTabGroup, type TabGroupApi } from "@/features/tabGroups";
import type { ResearchDatabaseSchema, StoredSession } from "@/shared/storage";

import { assertNoActiveSession } from "../assertNoActiveSession";
import { createSession } from "../createSession";
import { reconcileActiveSession } from "../reconcileActiveSession";

export interface StartSessionOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  title: string;
  api: TabGroupApi;
}

export interface StartedSession {
  session: StoredSession;
  group: CreatedTabGroup;
}

/**
 * Starts a research session: a new titled tab group, recorded as the active
 * session.
 *
 * A session whose group has gone is ended first, so it never blocks a start.
 * A live one refuses the start before any tab is opened. That early check is a
 * courtesy; the one that holds is inside {@link createSession}, which runs in
 * the transaction that writes. If the write fails, the group's tab is closed —
 * Firefox removes the emptied group — so no untracked group is left behind.
 *
 * @throws If a session is active, or any step fails.
 */
export const startSession = async ({
  database,
  title,
  api,
}: StartSessionOptions): Promise<StartedSession> => {
  assertNoActiveSession(await reconcileActiveSession({ database, getGroup: api.getGroup }));

  const group = await createTabGroup({ title, api });

  try {
    const session = await createSession({ database, title: group.title, groupId: group.groupId });

    return { session, group };
  } catch (error) {
    await api.removeTab(group.tabId);
    throw error;
  }
};
