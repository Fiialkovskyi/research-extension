import type { IDBPDatabase } from "idb";

import { type ResearchDatabaseSchema, SETTINGS_STORE } from "@/shared/storage";

/** Whether a newly recorded page shows a notice: on, until the user turned it off. */
export const isPageNoticeEnabled = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
): Promise<boolean> => (await database.get(SETTINGS_STORE, "user"))?.isPageNoticeEnabled !== false;
