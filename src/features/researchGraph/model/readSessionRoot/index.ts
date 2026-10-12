import type { IDBPDatabase } from "idb";

import { NODE_STORE, type ResearchDatabaseSchema, type StoredNode } from "@/shared/storage";

/**
 * Reads the session's root: its earliest SERP, the question the research
 * started from (REQ-CAP-003). `undefined` while the session has searched
 * nothing.
 *
 * `excludingNodeId` leaves one node out of the choice: capture asks for the
 * root a SERP it has just recorded refines, which is never that SERP itself,
 * even when both were recorded in the same millisecond.
 *
 * Derived from the nodes rather than stored on the session, so nothing has to
 * be kept in step when nodes are recorded, deleted or imported. A session holds
 * a few hundred nodes at most, which keeps the read cheap.
 */
export const readSessionRoot = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
  excludingNodeId?: string,
): Promise<StoredNode | undefined> => {
  const nodes = await database.getAllFromIndex(NODE_STORE, "sessionId", sessionId);

  return nodes
    .filter((node) => node.kind === "serp" && node.id !== excludingNodeId)
    .reduce<StoredNode | undefined>((earliest, node) => {
      // Ties broken by id, so two searches recorded in one millisecond — as
      // reconciliation can — still give the same root on every read.
      const isEarlier =
        earliest === undefined ||
        node.createdAt < earliest.createdAt ||
        (node.createdAt === earliest.createdAt && node.id < earliest.id);

      return isEarlier ? node : earliest;
    }, undefined);
};
