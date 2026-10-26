import type { IDBPDatabase } from "idb";

import { type ResearchDatabaseSchema, SESSION_STORE, type StoredSession } from "@/shared/storage";

export interface CreateSessionOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  title: string;
  /** The tab group the session follows, already created and titled. */
  groupId: number;
}

/**
 * Records a new active session for a tab group, which becomes the viewed one.
 *
 * Other sessions, active or closed, are left as they are: several sessions
 * record at once. A tab group belongs to at most one session, so the write
 * shares one `readwrite` transaction with the check that no live session
 * already follows (or followed) the group; IndexedDB runs overlapping
 * `readwrite` transactions on one store one after the other, so two starts for
 * one group cannot both pass it.
 *
 * @throws If a live session already owns the group.
 */
export const createSession = async ({
  database,
  title,
  groupId,
}: CreateSessionOptions): Promise<StoredSession> => {
  const transaction = database.transaction(SESSION_STORE, "readwrite");

  const live = [
    ...(await transaction.store.index("status").getAll("active")),
    ...(await transaction.store.index("status").getAll("closed")),
  ];

  if (live.some((other) => other.groupId === groupId || other.formerGroupIds.includes(groupId))) {
    throw new Error("That tab group already belongs to a session.");
  }

  const now = Date.now();

  const session: StoredSession = {
    id: crypto.randomUUID(),
    title,
    groupId,
    formerGroupIds: [],
    status: "active",
    viewedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await transaction.store.add(session);
  await transaction.done;

  return session;
};
