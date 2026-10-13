import type { IDBPDatabase } from "idb";

import type { DataKey } from "@/features/dataProtection";
import { readSealedFact } from "@/features/factExtraction";
import { ENTITY_STORE, FACT_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

import type { SummaryFact } from "../../../../types";

/**
 * Reads facts as a summary is built from them: decrypted, each grouped under
 * its root entity — the one it was merged into, if any — or, without an
 * entity, under its subject.
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

  return Promise.all(
    stored.map(async (fact) => {
      const { subject, attribute, value, unit, quote } = await readSealedFact(dataKey, fact);
      const entity = fact.entityId === undefined ? undefined : entities.get(fact.entityId);

      return {
        id: fact.id,
        nodeId: fact.nodeId,
        groupKey: entity?.mergedInto ?? entity?.id ?? `subject:${subject}`,
        subject,
        attribute,
        value,
        ...(unit === undefined ? {} : { unit }),
        quote,
      };
    }),
  );
};
