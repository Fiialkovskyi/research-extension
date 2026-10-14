import type { IDBPDatabase, IDBPTransaction, StoreNames } from "idb";

import {
  CHUNK_STORE,
  CLUSTERING_STORE,
  EDGE_STORE,
  ENTITY_STORE,
  EXTRACTION_STORE,
  FACT_STORE,
  HEARTBEAT_STORE,
  INFERENCE_RUN_STORE,
  JOB_STORE,
  KEY_STORE,
  MODEL_FILE_STORE,
  MODEL_STORE,
  NODE_STORE,
  SESSION_STORE,
  SNAPSHOT_STORE,
  SPACE_STORE,
  SUMMARY_STORE,
  TABLE_COLUMNS_STORE,
  REJECTION_STORE,
  QUESTION_STORE,
  BLOCKED_SITES_STORE,
  VECTOR_STORE,
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
  4: (database) => {
    const nodes = database.createObjectStore(NODE_STORE, { keyPath: "id" });
    nodes.createIndex("sessionId", "sessionId");
    nodes.createIndex("sessionTab", ["sessionId", "tabId"]);

    const edges = database.createObjectStore(EDGE_STORE, { keyPath: "id" });
    edges.createIndex("sessionId", "sessionId");
  },
  5: (database) => {
    const jobs = database.createObjectStore(JOB_STORE, { keyPath: "id" });
    jobs.createIndex("statusPriority", ["status", "priority"]);
  },
  6: (_database, transaction) => {
    // Sessions written before a session could follow more than one group carry
    // no list of former groups; an empty one says exactly that. The rewrite
    // runs inside the version-change transaction, which stays open while it
    // has requests pending, so the profile reaches version 6 only once done.
    const sessions = transaction.objectStore(SESSION_STORE);
    const rewrite = async (): Promise<void> => {
      let cursor = await sessions.openCursor();

      while (cursor !== null) {
        if (cursor.value.formerGroupIds === undefined) {
          await cursor.update({ ...cursor.value, formerGroupIds: [] });
        }

        cursor = await cursor.continue();
      }
    };

    void rewrite();
  },
  7: (database) => {
    // No index: a snapshot is found through the node that carries its id.
    // Session deletion adds the `sessionId` index with the first query on it.
    database.createObjectStore(SNAPSHOT_STORE, { keyPath: "id" });
  },
  8: (database) => {
    // Only the store: encrypting the snapshots already stored needs Web Crypto,
    // which a version-change transaction cannot wait for. The background seals
    // them when it next starts (`pageSnapshots/sealPlaintextSnapshots`).
    database.createObjectStore(KEY_STORE, { keyPath: "id" });
  },
  9: (_database, transaction) => {
    // Nodes recorded before quick returns were counted had none; zero says
    // exactly that. Rewritten inside the version-change transaction, like 6.
    const nodes = transaction.objectStore(NODE_STORE);
    const rewrite = async (): Promise<void> => {
      let cursor = await nodes.openCursor();

      while (cursor !== null) {
        if (cursor.value.signals.quickReturnCount === undefined) {
          await cursor.update({
            ...cursor.value,
            signals: { ...cursor.value.signals, quickReturnCount: 0 },
          });
        }

        cursor = await cursor.continue();
      }
    };

    void rewrite();
  },
  10: (database) => {
    database.createObjectStore(CLUSTERING_STORE, { keyPath: "sessionId" });
  },
  11: (database) => {
    database.createObjectStore(SPACE_STORE, { keyPath: "id" });

    const chunks = database.createObjectStore(CHUNK_STORE, { keyPath: "id" });

    chunks.createIndex("snapshotId", "snapshotId");
    // One key range per space: a query reads exactly one partition (REQ-LIN-001).
    database.createObjectStore(VECTOR_STORE, { keyPath: ["spaceId", "chunkId", "part"] });
  },
  12: (_database, transaction) => {
    // Deleting a page or a session reads exactly what it deletes (REQ-STO-008).
    transaction.objectStore(SNAPSHOT_STORE).createIndex("sessionId", "sessionId");
    transaction.objectStore(CHUNK_STORE).createIndex("sessionId", "sessionId");
    transaction.objectStore(VECTOR_STORE).createIndex("sessionId", "sessionId");
    transaction.objectStore(VECTOR_STORE).createIndex("nodeId", "nodeId");
    transaction.objectStore(JOB_STORE).createIndex("sessionId", "sessionId");
  },
  13: (database) => {
    // The background-lifetime probe's heartbeats: one key range per run.
    const heartbeats = database.createObjectStore(HEARTBEAT_STORE, {
      keyPath: ["runId", "writtenAt"],
    });

    heartbeats.createIndex("runId", "runId");
  },
  14: (database) => {
    // Facts and their per-snapshot extraction records, both deleted with
    // their page or session.
    const facts = database.createObjectStore(FACT_STORE, { keyPath: "id" });

    facts.createIndex("sessionId", "sessionId");
    facts.createIndex("nodeId", "nodeId");

    const extractions = database.createObjectStore(EXTRACTION_STORE, { keyPath: "snapshotId" });

    extractions.createIndex("sessionId", "sessionId");
    extractions.createIndex("nodeId", "nodeId");
  },
  15: (database, transaction) => {
    // Entities, and the facts each one holds, so deleting a page can find
    // the entities it leaves empty.
    database
      .createObjectStore(ENTITY_STORE, { keyPath: "id" })
      .createIndex("sessionId", "sessionId");
    transaction.objectStore(FACT_STORE).createIndex("entityId", "entityId");
  },
  16: (database) => {
    database
      .createObjectStore(SUMMARY_STORE, { keyPath: "id" })
      .createIndex("sessionId", "sessionId");
  },
  17: (database) => {
    database
      .createObjectStore(TABLE_COLUMNS_STORE, { keyPath: "id" })
      .createIndex("sessionId", "sessionId");
  },
  18: (database) => {
    database
      .createObjectStore(REJECTION_STORE, { keyPath: "id" })
      .createIndex("sessionId", "sessionId");
  },
  19: (database) => {
    database.createObjectStore(QUESTION_STORE, { keyPath: "sessionId" });
  },
  20: (database) => {
    database.createObjectStore(BLOCKED_SITES_STORE, { keyPath: "id" });
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
