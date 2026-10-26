import type { IDBPDatabase } from "idb";

import { type CreatedTabGroup, createTabGroup, type TabGroupApi } from "@/features/tabGroups";
import type { ResearchDatabaseSchema, StoredSession } from "@/shared/storage";

import { createSession } from "../createSession";

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
 * Starts a research session: a new titled tab group, recorded as an active
 * session beside any others.
 *
 * If the write fails, the group's tab is closed — Firefox removes the emptied
 * group — so no untracked group is left behind.
 *
 * @throws If any step fails.
 */
export const startSession = async ({
  database,
  title,
  api,
}: StartSessionOptions): Promise<StartedSession> => {
  const group = await createTabGroup({ title, api });

  try {
    const session = await createSession({ database, title: group.title, groupId: group.groupId });

    return { session, group };
  } catch (error) {
    await api.removeTab(group.tabId);
    throw error;
  }
};
