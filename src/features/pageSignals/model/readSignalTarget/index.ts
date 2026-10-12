import type { IDBPDatabase } from "idb";

import { readTabNode } from "@/features/researchGraph";
import { getActiveSession } from "@/features/researchSession";
import { NODE_STORE, type ResearchDatabaseSchema, type StoredNode } from "@/shared/storage";

import type { PageSender } from "../../types";
import { isSamePage } from "./utils/isSamePage";

/**
 * The node a content message belongs to, or why there is none: `stop` when the
 * tab is not a session tab any more, so its page stops observing.
 */
export type SignalTarget =
  | { node: StoredNode; isCurrent: boolean }
  | { node: undefined; stop: boolean };

/**
 * Finds the node of the page that sent a message.
 *
 * Usually the tab's current node. A page's last batch is sent as it is left,
 * and may arrive after the commit that replaced it; the node it replaced is
 * then the current node's parent, and the batch is still its. Anything else
 * comes from a page the graph has moved past and is dropped, never added to a
 * node it does not describe.
 */
export const readSignalTarget = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sender: PageSender,
): Promise<SignalTarget> => {
  const session = await getActiveSession(database);
  const current =
    session === undefined ? undefined : await readTabNode(database, session.id, sender.tabId);

  if (current === undefined) {
    return { node: undefined, stop: true };
  }

  if (isSamePage(current.url, sender.url)) {
    return { node: current, isCurrent: true };
  }

  const parent =
    current.parentNodeId === null
      ? undefined
      : await database.get(NODE_STORE, current.parentNodeId);

  if (parent !== undefined && isSamePage(parent.url, sender.url)) {
    return { node: parent, isCurrent: false };
  }

  return { node: undefined, stop: false };
};
