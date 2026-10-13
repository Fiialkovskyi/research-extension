import type { IDBPDatabase } from "idb";

import { FACT_STORE, type ResearchDatabaseSchema, type StoredCluster } from "@/shared/storage";

/** The ids of the facts a cluster's pages hold now. */
export const readClusterFactIds = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  cluster: Pick<StoredCluster, "memberIds">,
): Promise<string[]> =>
  (
    await Promise.all(
      cluster.memberIds.map((nodeId) => database.getAllKeysFromIndex(FACT_STORE, "nodeId", nodeId)),
    )
  ).flat();
