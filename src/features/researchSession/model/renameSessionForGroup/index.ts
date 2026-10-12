import type { IDBPDatabase } from "idb";

import { type ResearchDatabaseSchema, SESSION_STORE, type StoredSession } from "@/shared/storage";

/**
 * Gives the active session its group's new title.
 *
 * The user renames a session by renaming its group in the tab strip, so the
 * group's title is the source of truth. A group that is not the active
 * session's, a title that has not changed, or a blank one writes nothing: a
 * group whose title the user cleared still belongs to a session with a name.
 *
 * @returns The renamed session, or `undefined` when nothing changed.
 */
export const renameSessionForGroup = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  groupId: number,
  title: string,
): Promise<StoredSession | undefined> => {
  const nextTitle = title.trim();
  const transaction = database.transaction(SESSION_STORE, "readwrite");
  const active = await transaction.store.index("status").get("active");

  if (
    active === undefined ||
    active.groupId !== groupId ||
    active.title === nextTitle ||
    nextTitle === ""
  ) {
    await transaction.done;
    return undefined;
  }

  const renamed: StoredSession = { ...active, title: nextTitle, updatedAt: Date.now() };

  await transaction.store.put(renamed);
  await transaction.done;

  return renamed;
};
