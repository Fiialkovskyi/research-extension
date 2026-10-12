import type { IDBPDatabase } from "idb";

import { type ResearchDatabaseSchema, SESSION_STORE, type StoredSession } from "@/shared/storage";

import { assertNoActiveSession } from "../assertNoActiveSession";

export interface CreateSessionOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  title: string;
  /** The tab group the session follows, already created and titled. */
  groupId: number;
}

/**
 * Records a new active session for a tab group.
 *
 * The check for an active session and the write share one `readwrite`
 * transaction. IndexedDB runs overlapping `readwrite` transactions on one store
 * one after the other, so two starts requested at once cannot both pass the
 * check: the second sees the first's session and is refused.
 *
 * @throws If a session is already active.
 */
export const createSession = async ({
  database,
  title,
  groupId,
}: CreateSessionOptions): Promise<StoredSession> => {
  const transaction = database.transaction(SESSION_STORE, "readwrite");

  assertNoActiveSession(await transaction.store.index("status").get("active"));

  const now = Date.now();
  const session: StoredSession = {
    id: crypto.randomUUID(),
    title,
    groupId,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  await transaction.store.add(session);
  await transaction.done;

  return session;
};
