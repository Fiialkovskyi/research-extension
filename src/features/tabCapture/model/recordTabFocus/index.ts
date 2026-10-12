import type { IDBPDatabase } from "idb";

import { addNodeSignals, readTabNode } from "@/features/researchGraph";
import { getActiveSession } from "@/features/researchSession";
import type { ResearchDatabaseSchema } from "@/shared/storage";

/**
 * Counts that the user switched to a session tab, and when.
 *
 * Only the count and the time: how long the page was then read needs idle and
 * window focus, which a later change adds.
 */
export const recordTabFocus = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  tabId: number,
  now: number = Date.now(),
): Promise<void> => {
  const session = await getActiveSession(database);

  if (session === undefined) {
    return;
  }

  const node = await readTabNode(database, session.id, tabId);

  if (node !== undefined) {
    await addNodeSignals(database, node.id, { focusCount: 1, lastFocusedAt: now });
  }
};
