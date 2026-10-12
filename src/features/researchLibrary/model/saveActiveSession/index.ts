import type { IDBPDatabase } from "idb";

import { readTabNode } from "@/features/researchGraph";
import { getActiveSession } from "@/features/researchSession";
import type { CaptureTab } from "@/features/tabCapture";
import {
  NODE_STORE,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredLastPosition,
  type StoredNode,
  type StoredSavedTab,
  type StoredSession,
} from "@/shared/storage";

export interface SaveActiveSessionOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  /** The session group's tabs, in their order in the tab strip. */
  queryGroupTabs: (groupId: number) => Promise<CaptureTab[]>;
  now: number;
}

/** What saving left to do: the saved session, and the tabs to close. */
export interface SavedSession {
  session: StoredSession;
  tabs: CaptureTab[];
}

/** The page the user was on: the one in focus, or else the one focused last. */
const findLastPosition = (
  session: StoredSession,
  nodes: readonly StoredNode[],
): StoredLastPosition | undefined => {
  const node =
    nodes.find(({ id }) => id === session.focus?.nodeId) ??
    nodes
      .filter(({ lastFocusedAt }) => lastFocusedAt !== undefined)
      .toSorted((first, second) => (second.lastFocusedAt ?? 0) - (first.lastFocusedAt ?? 0))[0];

  return node === undefined
    ? undefined
    : { nodeId: node.id, title: node.title, readFraction: node.signals.maxScroll };
};

/**
 * Saves the active session (REQ-STO-003): records its tabs in order with the
 * page each shows, where the user left off, closes its pages and marks it
 * saved — in one transaction. Closing the tabs is the caller's, afterwards:
 * the session is no longer active by then, so their closing changes nothing.
 *
 * The caller has already had the pages send their pending signals and brought
 * reading time up to date.
 *
 * @returns The saved session and its tabs, or `undefined` without an active session.
 */
export const saveActiveSession = async ({
  database,
  queryGroupTabs,
  now,
}: SaveActiveSessionOptions): Promise<SavedSession | undefined> => {
  const active = await getActiveSession(database);

  if (active === undefined) {
    return undefined;
  }

  const tabs = await queryGroupTabs(active.groupId);
  const savedTabs: StoredSavedTab[] = [];

  for (const tab of tabs) {
    const node = await readTabNode(database, active.id, tab.id);

    if (node !== undefined) {
      savedTabs.push({ nodeId: node.id, url: node.url, title: node.title });
    }
  }

  const transaction = database.transaction([SESSION_STORE, NODE_STORE], "readwrite");
  const sessions = transaction.objectStore(SESSION_STORE);
  const nodeStore = transaction.objectStore(NODE_STORE);
  const session = await sessions.get(active.id);

  if (session?.status !== "active") {
    await transaction.done;
    return undefined;
  }

  const nodes = await nodeStore.index("sessionId").getAll(session.id);
  const lastPosition = findLastPosition(session, nodes);
  const { focus: _focus, ...withoutFocus } = session;
  const saved: StoredSession = {
    ...withoutFocus,
    status: "saved",
    savedTabs,
    ...(lastPosition === undefined ? {} : { lastPosition }),
    savedAt: now,
    updatedAt: now,
  };

  await Promise.all([
    sessions.put(saved),
    ...nodes
      .filter(({ tabState }) => tabState === "open")
      .map((node) => nodeStore.put({ ...node, tabState: "closed" })),
    transaction.done,
  ]);

  return { session: saved, tabs };
};
