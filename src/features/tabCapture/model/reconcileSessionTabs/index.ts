import type { IDBPDatabase } from "idb";

import { readBlockedSites } from "@/features/siteDenylist";
import { closeNode, recordNode } from "@/features/researchGraph";
import { getActiveSession } from "@/features/researchSession";
import { NODE_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

import { RESTORED_TRANSITION } from "../../constants";
import type { TabCaptureApi } from "../../types";
import { buildPageFields } from "../buildPageFields";
import { isCapturableUrl } from "../isCapturableUrl";
import { linkRefinement } from "../linkRefinement";
import { readTabTitle } from "../readTabTitle";

export interface ReconcileSessionTabsOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  api: TabCaptureApi;
}

/**
 * Brings the graph in line with the session's tabs after a restart.
 *
 * Tab ids are not stable across a restart, so an open node is kept only when a
 * tab of the group has both its tab id and its URL. Every other open node is
 * closed: its tab did not come back. A capturable tab of the group left without
 * a node is recorded as restored, with no parent, since its history before the
 * restart cannot be told apart from another tab's.
 */
export const reconcileSessionTabs = async ({
  database,
  api,
}: ReconcileSessionTabsOptions): Promise<void> => {
  const session = await getActiveSession(database);

  if (session === undefined) {
    return;
  }

  const tabs = (await api.queryGroupTabs(session.groupId)).filter((tab) => !tab.incognito);
  const openNodes = (await database.getAllFromIndex(NODE_STORE, "sessionId", session.id)).filter(
    (node) => node.tabState === "open",
  );
  const coveredTabIds = new Set<number>();

  for (const node of openNodes) {
    const isShown = tabs.some((tab) => tab.id === node.tabId && tab.url === node.url);

    if (isShown) {
      coveredTabIds.add(node.tabId);
    } else {
      await closeNode(database, node.id);
    }
  }

  const blockedSites = await readBlockedSites(database);

  for (const tab of tabs) {
    if (!coveredTabIds.has(tab.id) && isCapturableUrl(tab.url, blockedSites)) {
      const node = await recordNode(database, {
        sessionId: session.id,
        tabId: tab.id,
        url: tab.url,
        ...buildPageFields(tab.url),
        title: readTabTitle(tab, tab.url),
        parentNodeId: null,
        openerNodeId: null,
        transitionType: RESTORED_TRANSITION,
      });

      await linkRefinement(database, node);
    }
  }
};
