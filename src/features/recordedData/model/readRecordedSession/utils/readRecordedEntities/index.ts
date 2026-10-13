import type { IDBPDatabase } from "idb";

import { getDataKey } from "@/features/dataProtection";
import { readSealedEntity } from "@/features/entityResolution";
import { ENTITY_STORE, FACT_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

import type { RecordedEntity } from "../../../../types";

/**
 * The session's entities as the view shows them: each root entity, decrypted,
 * with the facts and pages it and the entities merged into it hold, and the
 * names merged into it. Biggest first.
 */
export const readRecordedEntities = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  sessionId: string,
): Promise<RecordedEntity[]> => {
  const stored = await database.getAllFromIndex(ENTITY_STORE, "sessionId", sessionId);

  if (stored.length === 0) {
    return [];
  }

  const dataKey = await getDataKey(database);
  const [names, facts] = await Promise.all([
    Promise.all(stored.map((entity) => readSealedEntity(dataKey, entity))),
    database.getAllFromIndex(FACT_STORE, "sessionId", sessionId),
  ]);
  const byId = new Map(
    stored.flatMap((entity, index) => {
      const sealed = names[index];

      return sealed === undefined ? [] : [[entity.id, { entity, ...sealed }] as const];
    }),
  );
  /** The root an entity resolves to: itself, or what it was merged into. */
  const readRoot = (entityId: string): string => {
    const mergedInto = byId.get(entityId)?.entity.mergedInto;

    return mergedInto !== undefined && byId.has(mergedInto) ? mergedInto : entityId;
  };

  return [...byId.values()]
    .filter(({ entity }) => readRoot(entity.id) === entity.id)
    .map(({ entity, name, type }) => {
      const held = facts.filter(
        ({ entityId }) => entityId !== undefined && readRoot(entityId) === entity.id,
      );

      return {
        id: entity.id,
        name,
        type,
        factCount: held.length,
        pageCount: new Set(held.map(({ nodeId }) => nodeId)).size,
        merged: [...byId.values()]
          .filter(
            (child) => child.entity.id !== entity.id && readRoot(child.entity.id) === entity.id,
          )
          .map((child) => ({ id: child.entity.id, name: child.name })),
      };
    })
    .toSorted((a, b) => b.factCount - a.factCount || a.name.localeCompare(b.name));
};
