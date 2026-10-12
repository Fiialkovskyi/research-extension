import type { IDBPDatabase } from "idb";

import { readSnapshotText } from "@/features/pageSnapshots";
import { getLiveSession } from "@/features/researchSession";
import { NODE_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

/**
 * A page's captured text, decrypted, for the user to read what was kept. Only
 * pages of the live session are served.
 *
 * @returns The text, or `null` when the page has no snapshot or is not the
 *   live session's.
 */
export const readRecordedText = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  nodeId: string,
): Promise<string | null> => {
  const [session, node] = await Promise.all([
    getLiveSession(database),
    database.get(NODE_STORE, nodeId),
  ]);

  if (session === undefined || node?.sessionId !== session.id || node.snapshotId === undefined) {
    return null;
  }

  return (await readSnapshotText(database, node.snapshotId)) ?? null;
};
