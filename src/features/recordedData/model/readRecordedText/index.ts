import type { IDBPDatabase } from "idb";

import { readSnapshotText } from "@/features/pageSnapshots";
import { NODE_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

/**
 * A page's captured text, decrypted, for the user to read what was kept. Only
 * pages of the given session are served.
 *
 * @returns The text, or `null` when the page has no snapshot or is not the
 *   session's.
 */
export const readRecordedText = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
  nodeId: string,
): Promise<string | null> => {
  const node = await database.get(NODE_STORE, nodeId);

  if (node?.sessionId !== sessionId || node.snapshotId === undefined) {
    return null;
  }

  return (await readSnapshotText(database, node.snapshotId)) ?? null;
};
