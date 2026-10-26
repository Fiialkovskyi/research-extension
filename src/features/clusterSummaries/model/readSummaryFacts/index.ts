import type { IDBPDatabase } from "idb";

import type { DataKey } from "@/features/dataProtection";
import { readSealedEntity } from "@/features/entityResolution";
import { PRODUCT_DATA_PROMPT, readSealedFact } from "@/features/factExtraction";
import { getAttributeKey } from "@/shared/getAttributeKey";
import { ENTITY_STORE, FACT_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

import type { SummaryFact } from "../../types";

/**
 * Reads facts as a summary is built from them: decrypted, each grouped under
 * its root entity — the one it was merged into, if any — or, without an
 * entity, under its subject, and named by that entity — what the model is
 * told the fact is about — or, when the entity's name cannot be read, by the
 * subject.
 */
export const readSummaryFacts = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  dataKey: DataKey,
  factIds: readonly string[],
): Promise<SummaryFact[]> => {
  const stored = (await Promise.all(factIds.map((id) => database.get(FACT_STORE, id)))).flatMap(
    (fact) => fact ?? [],
  );
  const entities = new Map(
    (
      await Promise.all(
        [...new Set(stored.flatMap(({ entityId }) => entityId ?? []))].map((id) =>
          database.get(ENTITY_STORE, id),
        ),
      )
    ).flatMap((entity) => (entity === undefined ? [] : [[entity.id, entity] as const])),
  );

  const roots = new Map(
    (
      await Promise.all(
        [...new Set([...entities.values()].map(({ id, mergedInto }) => mergedInto ?? id))].map(
          async (id) => {
            const root = entities.get(id) ?? (await database.get(ENTITY_STORE, id));
            const sealed =
              root === undefined
                ? undefined
                : await readSealedEntity(dataKey, root).catch(() => undefined);

            return sealed === undefined ? [] : [[id, sealed] as const];
          },
        ),
      )
    ).flat(),
  );

  return Promise.all(
    stored.map(async (fact) => {
      const { subject, attribute, value, unit, quote } = await readSealedFact(dataKey, fact);
      const entity = fact.entityId === undefined ? undefined : entities.get(fact.entityId);

      const rootId = entity?.mergedInto ?? entity?.id;

      return {
        id: fact.id,
        nodeId: fact.nodeId,
        groupKey: rootId ?? `subject:${subject}`,
        entityName: (rootId === undefined ? undefined : roots.get(rootId)?.name) ?? subject,
        entityType: (rootId === undefined ? undefined : roots.get(rootId)?.type) ?? "unknown",
        subject,
        attribute,
        attributeKey: getAttributeKey(attribute),
        isPageData: fact.provenance.prompt === PRODUCT_DATA_PROMPT,
        value,
        ...(unit === undefined ? {} : { unit }),
        quote,
      };
    }),
  );
};
