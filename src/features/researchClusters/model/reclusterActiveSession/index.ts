import type { IDBPDatabase } from "idb";

import { readSessionGraph } from "@/features/researchGraph";
import type { ResearchDatabaseSchema, StoredClustering } from "@/shared/storage";

import { clusterSession } from "../clusterSession";
import { readPageVectors } from "../readPageVectors";
import { readClustering } from "../readClustering";
import { storeClustering } from "../storeClustering";
import { SESSION_STORE } from "@/shared/storage";

/**
 * Clusters the active session's graph again and stores the result, keeping
 * cluster ids from its last clustering where they fit. With an embedding space,
 * the session's page vectors in it add semantic edges.
 *
 * @returns The new clustering, or `undefined` without an active session.
 */
export const reclusterActiveSession = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
  now: number = Date.now(),
): Promise<StoredClustering | undefined> => {
  const session = await database.get(SESSION_STORE, sessionId);

  if (session?.status !== "active") {
    return undefined;
  }

  const spaceId = session.activeEmbeddingSpaceId;
  const [{ nodes, edges }, previous, vectors] = await Promise.all([
    readSessionGraph(database, session.id),
    readClustering(database, session.id),
    spaceId === undefined ? undefined : readPageVectors(database, session.id, spaceId),
  ]);
  const clustering = clusterSession({
    sessionId: session.id,
    nodes,
    edges,
    previous: previous?.clusters ?? [],
    now,
    ...(spaceId === undefined || vectors === undefined ? {} : { semantic: { spaceId, vectors } }),
  });

  await storeClustering(database, clustering);

  return clustering;
};
