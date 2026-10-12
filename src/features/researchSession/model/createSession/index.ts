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
 * Records a new active session for a tab group, ending a closed one first.
 *
 * The check for an active session and the write share one `readwrite`
 * transaction. IndexedDB runs overlapping `readwrite` transactions on one store
 * one after the other, so two starts requested at once cannot both pass the
 * check: the second sees the first's session and is refused.
 *
 * A closed session — its group removed, and possibly coming back — does not
 * block a start. It is ended (kept as `saved`) in the same transaction, so at
 * most one session is ever active or closed, and a group the user restores
 * later cannot revive it alongside the new one.
 *
 * @throws If a session is already active.
 */
export const createSession = async ({
  database,
  title,
  groupId,
}: CreateSessionOptions): Promise<StoredSession> => {
  const transaction = database.transaction(SESSION_STORE, "readwrite");

  const statuses = transaction.store.index("status");

  assertNoActiveSession(await statuses.get("active"));

  const now = Date.now();
  const closed = await statuses.get("closed");

  if (closed !== undefined) {
    await transaction.store.put({ ...closed, status: "saved", updatedAt: now });
  }

  const session: StoredSession = {
    id: crypto.randomUUID(),
    title,
    groupId,
    formerGroupIds: [],
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  await transaction.store.add(session);
  await transaction.done;

  return session;
};
