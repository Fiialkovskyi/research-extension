import type { IDBPDatabase } from "idb";

import type { ResearchDatabaseSchema } from "@/shared/storage";

import { SESSION_TAB_VALUE_KEY } from "../../constants";
import type { SessionTab, SessionTabApi } from "../../types";
import { getLiveSession } from "../getLiveSession";

export interface TrackSessionTabMembershipOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  api: Pick<SessionTabApi, "getTabValue" | "setTabValue" | "removeTabValue">;
  /** A tab whose group just changed, as `tabs.onUpdated` reports it. */
  tab: SessionTab;
}

/**
 * Keeps a tab's session mark in step with its group.
 *
 * A tab that joins the session's group is marked, so it is recognised if it is
 * closed and restored later. A marked tab that leaves the group — the user
 * dragged it out, or ungrouped the group — loses its mark: it is no longer the
 * session's, and restoring it later must not pull it back in.
 */
export const trackSessionTabMembership = async ({
  database,
  api,
  tab,
}: TrackSessionTabMembershipOptions): Promise<void> => {
  const live = await getLiveSession(database);

  if (live === undefined) {
    return;
  }

  if (tab.groupId === live.groupId) {
    await api.setTabValue(tab.id, SESSION_TAB_VALUE_KEY, live.id);
    return;
  }

  if ((await api.getTabValue(tab.id, SESSION_TAB_VALUE_KEY)) === live.id) {
    await api.removeTabValue(tab.id, SESSION_TAB_VALUE_KEY);
  }
};
