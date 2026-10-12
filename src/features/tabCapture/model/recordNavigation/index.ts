import type { IDBPDatabase } from "idb";

import { closeNode, readTabNode, recordEdge, recordNode } from "@/features/researchGraph";
import { getActiveSession } from "@/features/researchSession";
import type { ResearchDatabaseSchema, StoredNode } from "@/shared/storage";

import { CAPTURE_EDGE_WEIGHTS } from "../../constants";
import type { CommittedNavigation, TabCaptureApi } from "../../types";
import { buildPageFields } from "../buildPageFields";
import { isCapturableUrl } from "../isCapturableUrl";
import { linkRefinement } from "../linkRefinement";
import { readTabTitle } from "../readTabTitle";

export interface RecordNavigationOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  api: TabCaptureApi;
  navigation: CommittedNavigation;
}

/**
 * Records a page committed in a session tab as a node of the graph.
 *
 * Only top-frame navigations to web pages in a non-private tab of the session's
 * group count, and a reload is not a new page (CAP-002). The new node follows
 * the tab's previous one, which is closed: a tab shows one page at a time, so
 * it has at most one open node. A tab's first node is linked to the page of the
 * tab that opened it (CAP-001).
 *
 * A non-web page in a session tab records nothing but still closes the node
 * the tab was showing, since the tab no longer shows it.
 *
 * @returns The recorded node, or `undefined` when the navigation is not captured.
 */
export const recordNavigation = async ({
  database,
  api,
  navigation,
}: RecordNavigationOptions): Promise<StoredNode | undefined> => {
  const { tabId, frameId, url, transitionType } = navigation;

  if (frameId !== 0 || transitionType === "reload") {
    return undefined;
  }

  const session = await getActiveSession(database);

  if (session === undefined) {
    return undefined;
  }

  const tab = await api.getTab(tabId);

  if (tab.incognito || tab.groupId !== session.groupId) {
    return undefined;
  }

  const parent = await readTabNode(database, session.id, tabId);

  if (!isCapturableUrl(url)) {
    if (parent !== undefined) {
      await closeNode(database, parent.id);
    }

    return undefined;
  }

  const opener =
    parent === undefined && tab.openerTabId !== undefined
      ? await readTabNode(database, session.id, tab.openerTabId)
      : undefined;

  const node = await recordNode(database, {
    sessionId: session.id,
    tabId,
    url,
    ...buildPageFields(url),
    title: readTabTitle(tab, url),
    parentNodeId: parent?.id ?? null,
    openerNodeId: opener?.id ?? null,
    transitionType,
  });

  if (parent !== undefined) {
    await recordEdge(database, {
      sessionId: session.id,
      kind: "sameTab",
      from: parent.id,
      to: node.id,
      weight: CAPTURE_EDGE_WEIGHTS.sameTab,
    });
    await closeNode(database, parent.id);
  }

  if (opener !== undefined) {
    await recordEdge(database, {
      sessionId: session.id,
      kind: "opener",
      from: opener.id,
      to: node.id,
      weight: CAPTURE_EDGE_WEIGHTS.opener,
    });
  }

  await linkRefinement(database, node);

  return node;
};
