import type { IDBPDatabase } from "idb";

import { type ResearchDatabaseSchema, SETTINGS_STORE } from "@/shared/storage";

/** Turns the notice on or off, keeping the rest of the user's settings. */
export const setPageNoticeEnabled = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  isEnabled: boolean,
): Promise<void> => {
  const transaction = database.transaction(SETTINGS_STORE, "readwrite");
  const record = await transaction.store.get("user");

  await transaction.store.put({ ...record, id: "user", isPageNoticeEnabled: isEnabled });
  await transaction.done;
};
