import type { IDBPDatabase } from "idb";

import { getDataKey } from "@/features/dataProtection";
import { readSealedFact } from "@/features/factExtraction";
import { FACT_STORE, REJECTION_STORE, type ResearchDatabaseSchema } from "@/shared/storage";

import { getFactKey } from "../getFactKey";

/**
 * Rejects facts (REQ-LIN-008): one rejection per distinct key among them,
 * in the facts' session. Facts that no longer exist are ignored.
 *
 * @returns How many rejections were stored.
 */
export const rejectFacts = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  factIds: readonly string[],
  now: number = Date.now(),
): Promise<number> => {
  const dataKey = await getDataKey(database);
  const facts = (await Promise.all(factIds.map((id) => database.get(FACT_STORE, id)))).flatMap(
    (fact) => fact ?? [],
  );
  const keyed = await Promise.all(
    facts.map(async (fact) => ({
      sessionId: fact.sessionId,
      key: await getFactKey(await readSealedFact(dataKey, fact)),
    })),
  );
  const rejections = [
    ...new Map(keyed.map((rejection) => [`${rejection.sessionId}:${rejection.key}`, rejection])),
  ];
  const write = database.transaction(REJECTION_STORE, "readwrite");

  await Promise.all([
    ...rejections.map(([id, { sessionId, key }]) =>
      write.store.put({ id, sessionId, key, createdAt: now }),
    ),
    write.done,
  ]);

  return rejections.length;
};
