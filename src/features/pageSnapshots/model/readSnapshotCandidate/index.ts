import type { IDBPDatabase } from "idb";

import { getNodeEngagement } from "@/features/researchGraph";
import { NODE_STORE, type ResearchDatabaseSchema, type StoredNode } from "@/shared/storage";

/**
 * Returns the node when its page's text should be captured now: its page is
 * still open, it is deep read, and it has no snapshot yet.
 *
 * Whether the node is focused does not matter here: focus only separates a
 * dead end from a skim, never a deep read from either.
 */
export const readSnapshotCandidate = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  nodeId: string,
): Promise<StoredNode | undefined> => {
  const node = await database.get(NODE_STORE, nodeId);

  if (
    node === undefined ||
    node.tabState !== "open" ||
    node.snapshotId !== undefined ||
    getNodeEngagement(node, { isFocused: true }) !== "deep_read"
  ) {
    return undefined;
  }

  return node;
};
