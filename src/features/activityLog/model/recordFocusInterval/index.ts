import type { IDBPDatabase } from "idb";

import { ACTIVITY_STORE, type ResearchDatabaseSchema, type StoredActivity } from "@/shared/storage";

/**
 * How far apart two intervals on one page may be and still read as one. A
 * visit is counted again on every focus event, and a blur that lasted under a
 * second is not a second visit worth a second block.
 */
const MERGE_GAP_MS = 1000;

/** An interval of active reading on one page. */
export interface FocusInterval {
  sessionId: string;
  nodeId: string;
  startedAt: number;
  endedAt: number;
}

/**
 * Logs an interval of active reading, extending the page's latest interval
 * instead when this one continues it.
 *
 * Read and write share one `readwrite` transaction, so two intervals arriving
 * together cannot both extend, or both miss, the same record.
 *
 * @returns The record the interval now lives in.
 */
export const recordFocusInterval = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  { sessionId, nodeId, startedAt, endedAt }: FocusInterval,
): Promise<StoredActivity> => {
  const transaction = database.transaction(ACTIVITY_STORE, "readwrite");
  const latest = (await transaction.store.index("nodeId").getAll(nodeId))
    .filter((record) => record.kind === "focus")
    .reduce<StoredActivity | undefined>(
      (found, record) => (found === undefined || record.endAt > found.endAt ? record : found),
      undefined,
    );
  const recorded: StoredActivity =
    latest !== undefined && startedAt >= latest.at && startedAt - latest.endAt <= MERGE_GAP_MS
      ? { ...latest, endAt: Math.max(latest.endAt, endedAt) }
      : {
          id: crypto.randomUUID(),
          sessionId,
          nodeId,
          kind: "focus",
          at: startedAt,
          endAt: endedAt,
        };

  await transaction.store.put(recorded);
  await transaction.done;

  return recorded;
};
