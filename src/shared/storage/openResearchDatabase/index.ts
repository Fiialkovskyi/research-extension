import { type IDBPDatabase, openDB } from "idb";

import { DATABASE_NAME, DATABASE_VERSION } from "../constants";
import { type ResearchDatabaseSchema } from "../types";
import { applyDatabaseUpgrade } from "./utils/applyDatabaseUpgrade";

/**
 * Opens the add-on's database, migrating the profile if it lags behind.
 *
 * Kept thin on purpose: the sequencing decisions live in
 * {@link applyDatabaseUpgrade}, which is testable without a live
 * connection, while this function does nothing but hand it the transaction.
 */
export const openResearchDatabase = (): Promise<IDBPDatabase<ResearchDatabaseSchema>> => {
  return openDB<ResearchDatabaseSchema>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade: (database, oldVersion, newVersion, transaction) => {
      applyDatabaseUpgrade(database, oldVersion, newVersion ?? DATABASE_VERSION, transaction);
    },
  });
};
