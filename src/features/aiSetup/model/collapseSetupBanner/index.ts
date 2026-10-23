import type { IDBPDatabase } from "idb";

import { AI_SETUP_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

/** Folds the popup's setup banner to one line, or unfolds it, keeping the rest of the record. */
export const collapseSetupBanner = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  isCollapsed: boolean,
): Promise<void> => {
  const transaction = database.transaction(AI_SETUP_STORE, "readwrite");
  const record = await transaction.store.get("user");

  await transaction.store.put({ ...record, id: "user", isBannerCollapsed: isCollapsed });
  await transaction.done;
};
