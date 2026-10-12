import type { IDBPDatabase } from "idb";

import { closeNode, readTabNode, recordEdge, recordNode } from "@/features/researchGraph";
import { getActiveSession } from "@/features/researchSession";
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
 * A tab that joined the session's group — dragged in by the user — is recorded
 * from the page it shows, linked to its opener when it has one. A tab that left
 * the group has its node closed and is not followed any further (CAP-004).
 * A tab that joined while showing no web page is recorded by its first commit.
 */
export const followTabMembership = async ({
  database,
  tab,
}: FollowTabMembershipOptions): Promise<void> => {
  const session = await getActiveSession(database);

  if (session === undefined) {
    return;
  }

  const current = await readTabNode(database, session.id, tab.id);

  if (tab.groupId !== session.groupId) {
    if (current !== undefined) {
      await closeNode(database, current.id);
    }

    return;
  }

  if (current !== undefined || tab.incognito || !isCapturableUrl(tab.url)) {
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
