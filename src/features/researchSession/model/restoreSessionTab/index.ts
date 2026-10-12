import type { IDBPDatabase } from "idb";

import type { ResearchDatabaseSchema } from "@/shared/storage";

import { NO_TAB_GROUP, SESSION_TAB_VALUE_KEY } from "../../constants";
import type { SessionTab, SessionTabApi } from "../../types";
import { getLiveSession } from "../getLiveSession";
import { rekeySession } from "../rekeySession";
import { reopenSessionForGroup } from "../reopenSessionForGroup";
import { isGroupPresent } from "./utils/isGroupPresent";

export interface RestoreSessionTabOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  api: SessionTabApi;
  /** A tab that has just been created, as `tabs.onCreated` reports it. */
  tab: SessionTab;
}

/**
 * What happened to a new tab:
 *
 * - `member`: it was created inside the session's group, and is now marked;
 * - `joined`: it is a session tab that came back outside the group, and was
 *   added to the session's group;
 * - `adopted`: it came back inside one of the session's former groups, while
 *   the current one is gone, so the session follows that group again;
 * - `regrouped`: it came back with no group left to join, so it got a new
 *   group with the session's title, and the session follows that group;
 * - `ignored`: it is not the live session's.
 */
export type RestoredTabOutcome = "member" | "joined" | "adopted" | "regrouped" | "ignored";

/**
 * Brings a newly created tab into the live session when it belongs there.
 *
 * Firefox restores a closed session tab in different ways depending on how its
 * group went (see the `add-session-restore` Findings): back into the group when
 * the group is open or restored with it, but on its own when the group is gone
 * for good. The tab's session value survives all of them and is readable as
 * soon as `tabs.onCreated` fires, so the value, not the group, decides.
 *
 * A tab created inside the session's group is marked here too. That covers
 * tabs Firefox opens there itself (from a link in a session tab) and every tab
 * of a group the user restores, which also reopens a closed session.
 */
export const restoreSessionTab = async ({
  database,
  api,
  tab,
}: RestoreSessionTabOptions): Promise<RestoredTabOutcome> => {
  const live = await getLiveSession(database);

  if (live === undefined) {
    return "ignored";
  }

  if (tab.groupId === live.groupId) {
    await api.setTabValue(tab.id, SESSION_TAB_VALUE_KEY, live.id);
    await reopenSessionForGroup(database, live.groupId);
    return "member";
  }

  if ((await api.getTabValue(tab.id, SESSION_TAB_VALUE_KEY)) !== live.id) {
    return "ignored";
  }

  if (await isGroupPresent(api.getGroup, live.groupId)) {
    await api.groupTabs({ tabIds: [tab.id], groupId: live.groupId });
    await reopenSessionForGroup(database, live.groupId);
    return "joined";
  }

  if (tab.groupId !== NO_TAB_GROUP) {
    // Inside some other group. Only a former group of the session is followed;
    // a group the tab was moved into would have cleared its mark.
    if (!live.formerGroupIds.includes(tab.groupId)) {
      return "ignored";
    }

    await rekeySession(database, live.id, tab.groupId);
    return "adopted";
  }

  const groupId = await api.groupTabs({ tabIds: [tab.id] });

  await api.updateGroup(groupId, { title: live.title });
  await rekeySession(database, live.id, groupId);

  return "regrouped";
};
