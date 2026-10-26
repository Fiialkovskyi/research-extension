import type { IDBPDatabase } from "idb";

import { readBlockedSites } from "@/features/siteDenylist";
import { getSessionForTab, listLiveSessions, NO_TAB_GROUP } from "@/features/researchSession";
import type { ResearchDatabaseSchema } from "@/shared/storage";

import type { CommittedNavigation, TabCaptureApi } from "../../types";
import { readBlockedHost } from "../readBlockedHost";

export interface ReadBlockedNavigationOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  api: TabCaptureApi;
  navigation: CommittedNavigation;
}

/** A refused page in a session's tab, as the notice that says so needs it. */
export interface BlockedNavigation {
  sessionId: string;
  sessionTitle: string;
  /** The host that is on the denylist. */
  host: string;
}

/**
 * Tells whether a navigation is a top-frame page of a denylisted site in a
 * non-private tab of an active session's group: the page `recordNavigation`
 * refuses, and the user should be told is not tracked.
 *
 * Reads and stores nothing about the page: it answers from the URL, the tab's
 * group and the session, and the result is for a notice, never for the graph.
 *
 * @returns The session and host, or `undefined` for every other navigation —
 *   a tab outside a session, a private tab, a page that is not on the
 *   denylist or not a web page.
 */
export const readBlockedNavigation = async ({
  database,
  api,
  navigation,
}: ReadBlockedNavigationOptions): Promise<BlockedNavigation | undefined> => {
  const { tabId, frameId, url } = navigation;

  if (frameId !== 0) {
    return undefined;
  }

  // The URL alone settles most navigations; the browser is asked only after.
  const host = readBlockedHost(url, await readBlockedSites(database));

  if (host === undefined) {
    return undefined;
  }

  if ((await listLiveSessions(database)).every(({ status }) => status !== "active")) {
    return undefined;
  }

  const tab = await api.getTab(tabId);

  if (tab.incognito) {
    return undefined;
  }

  const session = await getSessionForTab(database, { tabId, groupId: tab.groupId ?? NO_TAB_GROUP });

  return session === undefined
    ? undefined
    : { sessionId: session.id, sessionTitle: session.title, host };
};
