import type { IDBPDatabase } from "idb";
import * as v from "valibot";

import { getDataKey } from "@/features/dataProtection";
import { readSealedFact } from "@/features/factExtraction";
import { normalizeEntityName } from "@/shared/normalizeEntityName";
import {
  ENTITY_STORE,
  FACT_STORE,
  type ResearchDatabaseSchema,
  type StoredEntity,
  type StoredFact,
  type StoredJob,
} from "@/shared/storage";

import { ENTITY_EMBEDDING_BATCH_SIZE, UNKNOWN_TYPE } from "../../constants";
import { resolveEntitiesPayloadSchema } from "../../schemas";
import { type EntityCandidate, matchEntity } from "../matchEntity";
import { readSealedEntity } from "../readSealedEntity";
import { sealEntity } from "../sealEntity";
import { getCosineSimilarity } from "@/shared/getCosineSimilarity";

export interface RunEntityResolutionJobOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  job: StoredJob;
  /**
   * Embeds names with the active embedding model, as documents; absent when
   * none is active, and then only names are matched.
   */
  embed?: (texts: readonly string[]) => Promise<Float32Array[]>;
  now?: () => number;
}

/**
 * Assigns a page's facts to the entities of its session (SYN step 6): each fact
 * without an entity joins the one its subject matches by name, or by meaning
 * as a merged entity of its own, or starts a new one (`matchEntity`). New and
 * retyped entities are encrypted, then written with the facts' links in one
 * transaction; a fact that already has an entity is left alone, so a rerun
 * after an unload only finishes the rest.
 *
 * @returns How many facts were assigned.
 */
export const runEntityResolutionJob = async ({
  database,
  job,
  embed,
  now = Date.now,
}: RunEntityResolutionJobOptions): Promise<number> => {
  const { snapshotId } = v.parse(resolveEntitiesPayloadSchema, job.payload);
  const facts = (
    await database.getAll(FACT_STORE, IDBKeyRange.bound(`${snapshotId}:`, `${snapshotId}:￿`))
  ).filter(({ entityId }) => entityId === undefined);
  const [first] = facts;

  if (first === undefined) {
    return 0;
  }

  const { sessionId } = first;
  const dataKey = await getDataKey(database);
  const stored = await database.getAllFromIndex(ENTITY_STORE, "sessionId", sessionId);
  const candidates: EntityCandidate[] = await Promise.all(
    stored.map(async (entity) => ({
      ...(await readSealedEntity(dataKey, entity)),
      id: entity.id,
      isSeparated: entity.isSeparated,
      ...(entity.mergedInto === undefined ? {} : { mergedInto: entity.mergedInto }),
    })),
  );
  const records = new Map(stored.map((entity) => [entity.id, entity]));
  /** Entities to write, decrypted, by id. */
  const changed = new Map<string, EntityCandidate>();
  /** Name vectors for this run, by normalised name. */
  const vectors = new Map<string, Float32Array>();
  const linked: StoredFact[] = [];

  /** Embeds whichever of `names` has no vector yet, a batch at a time. */
  const embedNames = async (names: readonly string[]): Promise<void> => {
    if (embed === undefined) {
      return;
    }

    const missing = [...new Set(names.map(normalizeEntityName))].filter(
      (name) => !vectors.has(name),
    );
    const originals = new Map(names.map((name) => [normalizeEntityName(name), name]));

    for (let start = 0; start < missing.length; start += ENTITY_EMBEDDING_BATCH_SIZE) {
      const batch = missing.slice(start, start + ENTITY_EMBEDDING_BATCH_SIZE);
      const embedded = await embed(batch.map((name) => originals.get(name) ?? name));

      batch.forEach((name, index) => {
        const vector = embedded[index];

        if (vector !== undefined) {
          vectors.set(name, vector);
        }
      });
    }
  };

  for (const fact of facts.toSorted((a, b) => a.id.localeCompare(b.id))) {
    const { subject, entityType: type } = await readSealedFact(dataKey, fact);
    const sameType = candidates.filter(
      (entity) => entity.mergedInto === undefined && entity.type === type,
    );

    if (embed !== undefined && type !== UNKNOWN_TYPE && sameType.length > 0) {
      await embedNames([subject, ...sameType.map(({ name }) => name)]);
    }

    const subjectVector = vectors.get(normalizeEntityName(subject));
    const match = matchEntity({ name: subject, type }, candidates, (entityId) => {
      const entity = candidates.find(({ id }) => id === entityId);
      const vector =
        entity === undefined ? undefined : vectors.get(normalizeEntityName(entity.name));

      return subjectVector === undefined || vector === undefined
        ? undefined
        : getCosineSimilarity(subjectVector, vector);
    });
    let entityId: string;

    if (match.kind === "name") {
      entityId = match.entityId;

      const entity = candidates.find(({ id }) => id === entityId);

      // An entity first seen without a type takes the first known one.
      if (entity !== undefined && entity.type === UNKNOWN_TYPE && type !== UNKNOWN_TYPE) {
        entity.type = type;
        changed.set(entity.id, entity);
      }
    } else {
      const created: EntityCandidate = {
        id: crypto.randomUUID(),
        name: subject,
        type,
        isSeparated: false,
        ...(match.kind === "meaning" ? { mergedInto: match.entityId } : {}),
      };

      candidates.push(created);
      changed.set(created.id, created);
      entityId = created.id;
    }

    linked.push({ ...fact, entityId });
  }

  const sealed: StoredEntity[] = await Promise.all(
    [...changed.values()].map((entity) =>
      sealEntity(
        dataKey,
        { name: entity.name, type: entity.type },
        {
          id: entity.id,
          sessionId,
          isSeparated: entity.isSeparated,
          createdAt: records.get(entity.id)?.createdAt ?? now(),
          ...(entity.mergedInto === undefined ? {} : { mergedInto: entity.mergedInto }),
        },
      ),
    ),
  );
  const write = database.transaction([ENTITY_STORE, FACT_STORE], "readwrite");

  await Promise.all([
    ...sealed.map((entity) => write.objectStore(ENTITY_STORE).put(entity)),
    ...linked.map((fact) => write.objectStore(FACT_STORE).put(fact)),
    write.done,
  ]);

  return linked.length;
};
