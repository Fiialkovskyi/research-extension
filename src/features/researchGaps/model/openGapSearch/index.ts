import type { IDBPDatabase } from "idb";

import { NODE_STORE, type ResearchDatabaseSchema, SESSION_STORE } from "@/shared/storage";

import { buildSearchUrl } from "../buildSearchUrl";
import { chooseSearchEngine } from "../chooseSearchEngine";

/** The browser calls a gap's search uses. */
export interface GapSearchApi {
  createTab: (properties: { url: string; active: boolean }) => Promise<{ id?: number }>;
  groupTabs: (options: { tabIds: [number, ...number[]]; groupId: number }) => Promise<number>;
}

/**
 * Runs a gap's search inside the session (REQ-SYN-009): opens the results
 * page, on the engine the session's searches used most, in a new tab joined to
 * the session's group — where capture records it like any other search. The
 * extension only opens the tab; the page is the browser's request.
 *
 * @returns The URL opened.
 * @throws Without an active session.
 */
export const openGapSearch = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
  api: GapSearchApi,
  query: string,
): Promise<string> => {
  const session = await database.get(SESSION_STORE, sessionId);

  if (session?.status !== "active") {
    throw new Error("Start or reopen a session to search from its gaps.");
  }

  const serps = (await database.getAllFromIndex(NODE_STORE, "sessionId", session.id))
    .filter(({ kind }) => kind === "serp")
    .map(({ url }) => url);
  const url = buildSearchUrl(chooseSearchEngine(serps), query);
  const tab = await api.createTab({ url, active: true });

  if (tab.id !== undefined) {
    await api.groupTabs({ tabIds: [tab.id], groupId: session.groupId });
  }

  return url;
};
