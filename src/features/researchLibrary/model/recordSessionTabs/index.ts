import type { IDBPDatabase } from "idb";

import { readTabNode } from "@/features/researchGraph";
import { listLiveSessions } from "@/features/researchSession";
import type { CaptureTab } from "@/features/tabCapture";
import {
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredSavedTab,
  type StoredSession,
} from "@/shared/storage";

export interface RecordSessionTabsOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  /** The session group's tabs, in their order in the tab strip. */
  queryGroupTabs: (groupId: number) => Promise<CaptureTab[]>;
}

/** Two lists of saved tabs name the same pages in the same order. */
const isSameTabs = (
  first: readonly StoredSavedTab[] | undefined,
  second: readonly StoredSavedTab[],
): boolean =>
  first?.length === second.length &&
  first.every(
    (tab, index) =>
      tab.nodeId === second[index]?.nodeId &&
      tab.url === second[index]?.url &&
      tab.title === second[index]?.title,
  );

const recordOneSession = async (
  { database, queryGroupTabs }: RecordSessionTabsOptions,
  active: StoredSession,
): Promise<boolean> => {
  const savedTabs: StoredSavedTab[] = [];

  for (const tab of await queryGroupTabs(active.groupId)) {
    const node = await readTabNode(database, active.id, tab.id);

    if (node !== undefined) {
      savedTabs.push({ nodeId: node.id, url: node.url, title: node.title });
    }
  }

  if (savedTabs.length === 0 || isSameTabs(active.savedTabs, savedTabs)) {
    return false;
  }

  const transaction = database.transaction(SESSION_STORE, "readwrite");
  const session = await transaction.store.get(active.id);

  // The session may have closed while its tabs were read.
  if (session?.status !== "active") {
    await transaction.done;
    return false;
  }

  await transaction.store.put({ ...session, savedTabs });
  await transaction.done;

  return true;
};

/**
 * Keeps every active session's tabs saved (REQ-STO-003): each group's tabs in
 * order, each with the page it shows — what resuming reopens. Called after
 * every change capture records, so the sessions are saved without the user
 * asking, and by the time a group is gone its tabs are already on record.
 *
 * An empty group is not recorded: closing a group's tabs, last tab included,
 * empties it before Firefox reports the group removed, and the tabs it held
 * are the ones to keep.
 *
 * @returns Whether any session's recorded tabs changed.
 */
export const recordSessionTabs = async (options: RecordSessionTabsOptions): Promise<boolean> => {
  const sessions = (await listLiveSessions(options.database)).filter(
    ({ status }) => status === "active",
  );
  let isChanged = false;

  for (const session of sessions) {
    isChanged = (await recordOneSession(options, session)) || isChanged;
  }

  return isChanged;
};
