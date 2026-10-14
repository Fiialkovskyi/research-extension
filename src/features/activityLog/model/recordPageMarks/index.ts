import type { IDBPDatabase } from "idb";

import { ACTIVITY_STORE, type ResearchDatabaseSchema, type StoredActivity } from "@/shared/storage";

/** Copies and pastes one page reported, and when they were received. */
export interface PageMarks {
  sessionId: string;
  nodeId: string;
  copyEvents: number;
  pasteEvents: number;
  /**
   * When the batch reached the background. The page's own clock is not
   * trusted; a batch is at most a few seconds old, which a timeline in minutes
   * cannot show.
   */
  at: number;
}

/**
 * Logs each copy and paste of a page's batch as a record of its own, so a
 * timeline can mark them. Only that they happened, and when: what was copied
 * or pasted is never part of the batch.
 *
 * @returns The records written, copies first.
 */
export const recordPageMarks = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  { sessionId, nodeId, copyEvents, pasteEvents, at }: PageMarks,
): Promise<StoredActivity[]> => {
  const build = (kind: "copy" | "paste"): StoredActivity => ({
    id: crypto.randomUUID(),
    sessionId,
    nodeId,
    kind,
    at,
    endAt: at,
  });
  const records = [
    ...Array.from({ length: copyEvents }, () => build("copy")),
    ...Array.from({ length: pasteEvents }, () => build("paste")),
  ];

  if (records.length === 0) {
    return records;
  }

  const transaction = database.transaction(ACTIVITY_STORE, "readwrite");

  await Promise.all([...records.map((record) => transaction.store.add(record)), transaction.done]);

  return records;
};
