import type { IDBPDatabase } from "idb";

import { readBlockedSites } from "@/features/siteDenylist";
import { closeNode, readTabNode, recordEdge, recordNode } from "@/features/researchGraph";
import { getSessionForGroup, listLiveSessions, NO_TAB_GROUP } from "@/features/researchSession";
import type { ResearchDatabaseSchema } from "@/shared/storage";

import { CAPTURE_EDGE_WEIGHTS, JOINED_TRANSITION } from "../../constants";
import type { CaptureTab } from "../../types";
import { buildPageFields } from "../buildPageFields";
import { isCapturableUrl } from "../isCapturableUrl";
import { linkRefinement } from "../linkRefinement";
import { readTabTitle } from "../readTabTitle";

export interface FollowTabMembershipOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  /** The tab as reported after its group changed. */
  tab: CaptureTab;
}

/**
 * Brings the graph in line with a tab whose group changed.
 *
 * A tab that joined a session's group — dragged in by the user — is recorded
 * from the page it shows, linked to its opener when it has one. A tab that left
 * a session's group has its node in that session closed and is not followed
 * there any further (CAP-004); dragged from one session's group into another's,
 * it does both. A tab that joined while showing no web page is recorded by its
 * first commit.
 */
export const followTabMembership = async ({
  database,
  tab,
}: FollowTabMembershipOptions): Promise<void> => {
  const joined = await getSessionForGroup(database, tab.groupId ?? NO_TAB_GROUP);
  const session = joined?.status === "active" ? joined : undefined;
  const active = (await listLiveSessions(database)).filter(({ status }) => status === "active");

  for (const other of active) {
    if (other.id !== session?.id) {
      const left = await readTabNode(database, other.id, tab.id);

      if (left !== undefined) {
        await closeNode(database, left.id);
      }
    }
  }

  if (session === undefined) {
    return;
  }

  const current = await readTabNode(database, session.id, tab.id);

  if (
    current !== undefined ||
    tab.incognito ||
    !isCapturableUrl(tab.url, await readBlockedSites(database))
  ) {
    return;
  }

  const opener =
    tab.openerTabId === undefined
      ? undefined
      : await readTabNode(database, session.id, tab.openerTabId);

  const node = await recordNode(database, {
    sessionId: session.id,
    tabId: tab.id,
    url: tab.url,
    ...buildPageFields(tab.url),
    title: readTabTitle(tab, tab.url),
    parentNodeId: null,
    openerNodeId: opener?.id ?? null,
    transitionType: JOINED_TRANSITION,
  });

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
};
