import type { IDBPDatabase } from "idb";

import { reconcileActiveSession } from "@/features/researchSession";
import {
  NODE_STORE,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredSession,
} from "@/shared/storage";

/** The browser calls resuming a session uses. */
export interface ResumeApi {
  /**
   * Opens a tab. `discarded` opens it without loading its page until it is
   * shown; `title` is what such a tab shows meanwhile.
   */
  createTab: (properties: {
    url?: string;
    active: boolean;
    discarded?: boolean;
    title?: string;
  }) => Promise<{ id?: number }>;
  groupTabs: (options: { tabIds: [number, ...number[]] }) => Promise<number>;
  updateGroup: (groupId: number, properties: { title: string }) => Promise<unknown>;
  getGroup: (groupId: number) => Promise<{ color: string; title?: string }>;
  activateTab: (tabId: number) => Promise<unknown>;
  removeTab: (tabId: number) => Promise<void>;
}

export interface ResumeSessionOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  sessionId: string;
  api: ResumeApi;
  now: number;
}

/**
 * Resumes a saved session (REQ-STO-005): a new tab group with its title holds
 * its saved tabs in order — each unloaded until shown, except the page the user
 * left off at, which is loaded and selected — and the session's pages are
 * reopened on those tabs rather than recorded again.
 *
 * Refused while another session is active; a closed session is ended, as
 * starting a session does. If opening the tabs fails, those already opened
 * are closed again.
 *
 * @throws When a session is active, the session is not saved, or the browser refuses.
 */
export const resumeSession = async ({
  database,
  sessionId,
  api,
  now,
}: ResumeSessionOptions): Promise<StoredSession> => {
  const live = await reconcileActiveSession({ database, getGroup: api.getGroup });

  if (live !== undefined) {
    throw new Error(`A session is already active: "${live.title}".`);
  }

  const session = await database.get(SESSION_STORE, sessionId);

  if (session?.status !== "saved") {
    throw new Error("Only a saved session can be resumed.");
  }

  const savedTabs = session.savedTabs ?? [];
  const leftOff = Math.max(
    0,
    savedTabs.findIndex(({ nodeId }) => nodeId === session.lastPosition?.nodeId),
  );
  const opened: number[] = [];

  try {
    if (savedTabs.length === 0) {
      const { id } = await api.createTab({ active: true });

      if (id !== undefined) {
        opened.push(id);
      }
    }

    for (const [index, tab] of savedTabs.entries()) {
      const isLeftOff = index === leftOff;
      const { id } = await api.createTab({
        url: tab.url,
        active: isLeftOff,
        ...(isLeftOff ? {} : { discarded: true, title: tab.title }),
      });

      if (id === undefined) {
        throw new Error(`The browser opened no tab for ${tab.url}.`);
      }

      opened.push(id);
    }

    const [first, ...rest] = opened;

    if (first === undefined) {
      throw new Error("The browser opened no tab for the session.");
    }

    const groupId = await api.groupTabs({ tabIds: [first, ...rest] });

    await api.updateGroup(groupId, { title: session.title });
    await api.activateTab(opened[savedTabs.length === 0 ? 0 : leftOff] ?? first);

    const transaction = database.transaction([SESSION_STORE, NODE_STORE], "readwrite");
    const sessions = transaction.objectStore(SESSION_STORE);
    const nodes = transaction.objectStore(NODE_STORE);
    const statuses = sessions.index("status");

    if ((await statuses.get("active")) !== undefined) {
      throw new Error("A session became active while this one was being resumed.");
    }

    const closed = await statuses.get("closed");
    const resumed: StoredSession = {
      ...session,
      status: "active",
      groupId,
      formerGroupIds: [...session.formerGroupIds, session.groupId],
      updatedAt: now,
    };
    const reopened = await Promise.all(
      savedTabs.map(async ({ nodeId }, index) => {
        const node = await nodes.get(nodeId);

        return node === undefined
          ? undefined
          : { ...node, tabId: opened[index] ?? node.tabId, tabState: "open" as const };
      }),
    );

    await Promise.all([
      ...(closed === undefined
        ? []
        : [sessions.put({ ...closed, status: "saved", updatedAt: now })]),
      sessions.put(resumed),
      ...reopened.flatMap((node) => (node === undefined ? [] : [nodes.put(node)])),
      transaction.done,
    ]);

    return resumed;
  } catch (error) {
    await Promise.allSettled(opened.map((tabId) => api.removeTab(tabId)));
    throw error;
  }
};
