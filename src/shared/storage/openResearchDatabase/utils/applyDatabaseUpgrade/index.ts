import type { IDBPDatabase, IDBPTransaction, StoreNames } from "idb";

import {
  INFERENCE_RUN_STORE,
  MODEL_FILE_STORE,
  MODEL_STORE,
  SESSION_STORE,
} from "../../../constants";
import { type ResearchDatabaseSchema } from "../../../types";

/**
 * One forward-only migration step, applied when a profile crosses its version.
 *
 * Steps are never edited once released: a profile that already ran step 1 will
 * not run it again, so changing it would leave two profiles with different
 * schemas and the same version number.
 */
type UpgradeStep = (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  transaction: IDBPTransaction<
    ResearchDatabaseSchema,
    StoreNames<ResearchDatabaseSchema>[],
    "versionchange"
  >,
) => void;

/** Keyed by the version each step upgrades the profile *to*. */
export const UPGRADE_STEPS: Readonly<Record<number, UpgradeStep>> = {
  1: (database) => {
    const models = database.createObjectStore(MODEL_STORE, { keyPath: "ref" });
    models.createIndex("family", "manifest.contract.family");

    const files = database.createObjectStore(MODEL_FILE_STORE, { keyPath: ["ref", "path"] });
    files.createIndex("ref", "ref");

    const runs = database.createObjectStore(INFERENCE_RUN_STORE, { keyPath: "runId" });
    runs.createIndex("modelRef", "modelRef");
  },
  2: (_database, transaction) => {
    transaction.objectStore(INFERENCE_RUN_STORE).createIndex("startedAt", "startedAt");
  },
  3: (database) => {
    const sessions = database.createObjectStore(SESSION_STORE, { keyPath: "id" });
    sessions.createIndex("status", "status");
  },
};

/**
 * Runs every migration step the profile has not yet seen, in order.
 *
 * All of it happens inside the single version-change transaction the caller
 * provides, so a step that throws aborts the whole upgrade and the profile is
 * left at the version it had. That is what makes the migration safe to retry.
 */
export const applyDatabaseUpgrade = (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  oldVersion: number,
  targetVersion: number,
  transaction: IDBPTransaction<
    ResearchDatabaseSchema,
    StoreNames<ResearchDatabaseSchema>[],
    "versionchange"
  >,
  steps: Readonly<Record<number, UpgradeStep>> = UPGRADE_STEPS,
): void => {
  for (let version = oldVersion + 1; version <= targetVersion; version += 1) {
    const step = steps[version];

    if (step === undefined) {
      throw new Error(
        `No migration step defined for database version ${version}. ` +
          `A profile cannot be upgraded past a gap in the sequence.`,
      );
    }

    step(database, transaction);
  }
};
