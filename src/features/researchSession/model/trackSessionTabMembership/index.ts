import type { IDBPDatabase } from "idb";

import type { ResearchDatabaseSchema } from "@/shared/storage";

import { SESSION_TAB_VALUE_KEY } from "../../constants";
import type { SessionTab, SessionTabApi } from "../../types";
import { listLiveSessions } from "../listLiveSessions";

export interface TrackSessionTabMembershipOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  api: Pick<SessionTabApi, "getTabValue" | "setTabValue" | "removeTabValue">;
  /** A tab whose group just changed, as `tabs.onUpdated` reports it. */
  tab: SessionTab;
}

/**
 * Keeps a tab's session mark in step with its group.
 *
 * A tab that joins a session's group is marked with that session, so it is recognised if it is
 * closed and restored later. A marked tab that leaves every session's group —
 * the user dragged it out, or ungrouped the group — loses its mark: it is no
 * longer a session's, and restoring it later must not pull it back in.
 */
export const trackSessionTabMembership = async ({
  database,
  api,
  tab,
}: TrackSessionTabMembershipOptions): Promise<void> => {
  const live = await listLiveSessions(database);

  if (live.length === 0) {
    return;
  }

  const joined = live.find(({ groupId }) => groupId === tab.groupId);

  if (joined !== undefined) {
    await api.setTabValue(tab.id, SESSION_TAB_VALUE_KEY, joined.id);
    return;
  }

  const markedId = await api.getTabValue(tab.id, SESSION_TAB_VALUE_KEY);

  if (live.some(({ id }) => id === markedId)) {
    await api.removeTabValue(tab.id, SESSION_TAB_VALUE_KEY);
  }
};
