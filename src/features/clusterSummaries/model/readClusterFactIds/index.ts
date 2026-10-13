import type { IDBPDatabase } from "idb";

import { getDataKey } from "@/features/dataProtection";
import { readSealedFact } from "@/features/factExtraction";
import { filterRejectedFacts, readRejectedKeys } from "@/features/factRejections";
import { FACT_STORE, type ResearchDatabaseSchema, type StoredCluster } from "@/shared/storage";

/**
 * The ids of the facts a cluster's pages hold now, without those the user
 * marked wrong (REQ-LIN-008) — so a rejection changes the cluster's fact set,
 * and its summary turns stale. Facts are decrypted only when the session has
 * rejections.
 */
export const readClusterFactIds = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  cluster: Pick<StoredCluster, "memberIds">,
  sessionId: string,
): Promise<string[]> => {
  const facts = (
    await Promise.all(
      cluster.memberIds.map((nodeId) => database.getAllFromIndex(FACT_STORE, "nodeId", nodeId)),
    )
  ).flat();
  const rejectedKeys = await readRejectedKeys(database, sessionId);

  if (rejectedKeys.size === 0) {
    return facts.map(({ id }) => id);
  }

  const dataKey = await getDataKey(database);
  const read = await Promise.all(
    facts.map(async (fact) => ({ id: fact.id, ...(await readSealedFact(dataKey, fact)) })),
  );

  return (await filterRejectedFacts(read, rejectedKeys)).map(({ id }) => id);
};
