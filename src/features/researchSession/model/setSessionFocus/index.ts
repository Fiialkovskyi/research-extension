import type { IDBPDatabase } from "idb";

import {
  type ResearchDatabaseSchema,
  SESSION_STORE,
  type StoredFocusSwitch,
  type StoredFocusVisit,
} from "@/shared/storage";

/** What the session keeps about focus: the visit now, and the recent moves. */
export interface SessionFocus {
  focus: StoredFocusVisit;
  recentSwitches: StoredFocusSwitch[];
  /** The user moved on from where they left off: stop saying where that was. */
  clearLastPosition?: boolean;
}

/**
 * Records the visit the user is on now, and the recent moves of focus, on the
 * active session.
 *
 * Written only while that session is still the active one: a session closed
 * between reading it and writing here keeps the visit it had.
 *
 * @returns Whether the visit was written.
 */
export const setSessionFocus = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
  { focus, recentSwitches, clearLastPosition = false }: SessionFocus,
): Promise<boolean> => {
  const transaction = database.transaction(SESSION_STORE, "readwrite");
  const session = await transaction.store.get(sessionId);

  if (session?.status !== "active") {
    await transaction.done;
    return false;
  }

  const { lastPosition, ...rest } = session;

  await transaction.store.put({
    ...rest,
    ...(clearLastPosition || lastPosition === undefined ? {} : { lastPosition }),
    focus,
    recentSwitches,
  });
  await transaction.done;

  return true;
};
