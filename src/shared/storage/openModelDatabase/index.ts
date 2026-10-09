import { type IDBPDatabase, openDB } from "idb";

import { MODEL_DATABASE_NAME, MODEL_DATABASE_VERSION } from "../constants";
import { type ModelDatabaseSchema } from "../types";
import { applyModelDatabaseUpgrade } from "./utils/applyModelDatabaseUpgrade";

/**
 * Opens the add-on's database, migrating the profile if it lags behind.
 *
 * Kept thin on purpose: the sequencing decisions live in
 * {@link applyModelDatabaseUpgrade}, which is testable without a live
 * connection, while this function does nothing but hand it the transaction.
 */
export const openModelDatabase = (): Promise<IDBPDatabase<ModelDatabaseSchema>> => {
  return openDB<ModelDatabaseSchema>(MODEL_DATABASE_NAME, MODEL_DATABASE_VERSION, {
    upgrade: (database, oldVersion, newVersion, transaction) => {
      applyModelDatabaseUpgrade(
        database,
        oldVersion,
        newVersion ?? MODEL_DATABASE_VERSION,
        transaction,
      );
    },
  });
};
