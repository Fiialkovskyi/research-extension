import type { IDBPDatabase } from "idb";

import { readSessionGraph } from "@/features/researchGraph";
import { getActiveSession } from "@/features/researchSession";
import type { ResearchDatabaseSchema, StoredClustering } from "@/shared/storage";

import { clusterSession } from "../clusterSession";
import { readClustering } from "../readClustering";
import { storeClustering } from "../storeClustering";

/**
 * Clusters the active session's graph again and stores the result, keeping
 * cluster ids from its last clustering where they fit.
 *
 * @returns The new clustering, or `undefined` without an active session.
 */
export const reclusterActiveSession = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  now: number = Date.now(),
): Promise<StoredClustering | undefined> => {
  const session = await getActiveSession(database);

  if (session === undefined) {
    return undefined;
  }

  const [{ nodes, edges }, previous] = await Promise.all([
    readSessionGraph(database, session.id),
    readClustering(database, session.id),
  ]);
  const clustering = clusterSession({
    sessionId: session.id,
    nodes,
    edges,
    previous: previous?.clusters ?? [],
    now,
  });

  await storeClustering(database, clustering);

  return clustering;
};
