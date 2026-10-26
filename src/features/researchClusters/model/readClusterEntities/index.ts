import type { IDBPDatabase } from "idb";

import { getDataKey } from "@/features/dataProtection";
import { readSealedEntity } from "@/features/entityResolution";
import { readSealedFact } from "@/features/factExtraction";
import { filterRejectedFacts, readRejectedKeys } from "@/features/factRejections";
import { ENTITY_STORE, FACT_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

import { MINIMUM_CLUSTER_ENTITY_FACTS } from "../../constants";
import type { ClusterEntity } from "../clusterSession/utils/buildEntityEdges";

/**
 * Reads the entities a session resolved, as clustering uses them: each root
 * entity — the one others were merged into — that has at least
 * {@link MINIMUM_CLUSTER_ENTITY_FACTS} facts the user did not mark wrong, with
 * its name and the pages that state those facts. Facts are decrypted only when
 * the session has rejections, and the names only of the entities that count.
 *
 * Clustering must never fail for want of this: when the data key or an entity
 * cannot be read, there are no entities, and the pages are clustered as before.
 */
export const readClusterEntities = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
): Promise<ClusterEntity[]> => {
  try {
    const [facts, entities, rejectedKeys] = await Promise.all([
      database.getAllFromIndex(FACT_STORE, "sessionId", sessionId),
      database.getAllFromIndex(ENTITY_STORE, "sessionId", sessionId),
      readRejectedKeys(database, sessionId),
    ]);
    const dataKey = await getDataKey(database);
    const kept =
      rejectedKeys.size === 0
        ? facts
        : (
            await filterRejectedFacts(
              await Promise.all(
                facts.map(async (fact) => ({ fact, ...(await readSealedFact(dataKey, fact)) })),
              ),
              rejectedKeys,
            )
          ).map(({ fact }) => fact);
    const rootOf = new Map(entities.map(({ id, mergedInto }) => [id, mergedInto ?? id]));
    const byRoot = Map.groupBy(
      kept.flatMap((fact) => {
        const root = fact.entityId === undefined ? undefined : rootOf.get(fact.entityId);

        return root === undefined ? [] : [{ root, nodeId: fact.nodeId }];
      }),
      ({ root }) => root,
    );
    const records = new Map(entities.map((entity) => [entity.id, entity]));

    return (
      await Promise.all(
        [...byRoot.entries()]
          .filter(([, members]) => members.length >= MINIMUM_CLUSTER_ENTITY_FACTS)
          .map(async ([root, members]): Promise<ClusterEntity[]> => {
            const record = records.get(root);

            if (record === undefined) {
              return [];
            }

            const { name } = await readSealedEntity(dataKey, record);

            return [
              {
                name,
                factCount: members.length,
                pages: [...Map.groupBy(members, ({ nodeId }) => nodeId).entries()].map(
                  ([nodeId, stating]) => ({ nodeId, factCount: stating.length }),
                ),
              },
            ];
          }),
      )
    ).flat();
  } catch {
    return [];
  }
};
