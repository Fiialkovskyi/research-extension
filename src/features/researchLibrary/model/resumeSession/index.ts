import type { IDBPDatabase } from "idb";

import {
  NODE_STORE,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredSession,
} from "@/shared/storage";

const isGroupAlive = async (api: ResumeApi, groupId: number): Promise<boolean> => {
  try {
    await api.getGroup(groupId);
    return true;
  } catch {
    // Firefox rejects a lookup for a group that does not exist.
    return false;
  }
};

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
 * Other sessions, active or closed, are left as they are: several sessions
 * record at once. A closed session can be resumed unless its group is still
 * open, which would duplicate its tabs. If opening the tabs fails, those
 * already opened are closed again.
 *
 * @throws When the session is not saved or closed, its group is still open, or
 * the browser refuses.
 */
export const resumeSession = async ({
  database,
  sessionId,
  api,
  now,
}: ResumeSessionOptions): Promise<StoredSession> => {
  const session = await database.get(SESSION_STORE, sessionId);

  if (session?.status !== "saved" && session?.status !== "closed") {
    throw new Error("Only a saved session can be resumed.");
  }

  if (session.status === "closed" && (await isGroupAlive(api, session.groupId))) {
    // Resuming would open its tabs a second time beside the ones still there.
    throw new Error(`"${session.title}" is still open in its tab group.`);
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
    const current = await sessions.get(session.id);

    if (current?.status !== "saved" && current?.status !== "closed") {
      throw new Error("The session changed while it was being resumed.");
    }

    const resumed: StoredSession = {
      ...session,
      status: "active",
      viewedAt: now,
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
    // A window that closed with the session's group left its pages open, on
    // tabs that are gone; only the pages reopened here are open now.
    const reopenedIds = new Set(savedTabs.map(({ nodeId }) => nodeId));
    const stale = (await nodes.index("sessionId").getAll(session.id)).filter(
      ({ id, tabState }) => tabState === "open" && !reopenedIds.has(id),
    );

    await Promise.all([
      sessions.put(resumed),
      ...reopened.flatMap((node) => (node === undefined ? [] : [nodes.put(node)])),
      ...stale.map((node) => nodes.put({ ...node, tabState: "closed" })),
      transaction.done,
    ]);

    return resumed;
  } catch (error) {
    await Promise.allSettled(opened.map((tabId) => api.removeTab(tabId)));
    throw error;
  }
};
