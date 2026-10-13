import { normalizeEntityName } from "@/shared/normalizeEntityName";

import { ENTITY_SIMILARITY_THRESHOLD, UNKNOWN_TYPE } from "../../constants";

/** An entity of the session as matching sees it: decrypted, with its merge state. */
export interface EntityCandidate {
  id: string;
  name: string;
  type: string;
  mergedInto?: string;
  isSeparated: boolean;
}

/** What a subject matched. */
export type EntityMatch =
  | { kind: "name"; entityId: string }
  | { kind: "meaning"; entityId: string; similarity: number }
  | { kind: "new" };

/**
 * Finds the entity a fact's subject belongs to (SYN step 6).
 *
 * 1. By name: an entity whose normalised name equals the subject's, with an
 *    equal type or either side `unknown` — a merged one too, so a name seen
 *    again joins the same entity rather than merging a second time.
 * 2. By meaning: the root entity of the same known type whose name's
 *    embedding is most similar, at least {@link ENTITY_SIMILARITY_THRESHOLD}.
 *    `similarityTo` gives the similarity of the subject's name to an entity's,
 *    or nothing when there is no embedding model.
 *
 * Only roots are matched by meaning, so merges stay one level deep, and an
 * entity the user separated is never merged again: only a new subject's own
 * entity is ever merged. A subject that matches nothing becomes a new entity.
 */
export const matchEntity = (
  subject: { name: string; type: string },
  entities: readonly EntityCandidate[],
  similarityTo: (entityId: string) => number | undefined = () => undefined,
): EntityMatch => {
  const roots = entities.filter(({ mergedInto }) => mergedInto === undefined);
  const name = normalizeEntityName(subject.name);
  const byName = entities.find(
    (entity) =>
      normalizeEntityName(entity.name) === name &&
      (entity.type === subject.type ||
        entity.type === UNKNOWN_TYPE ||
        subject.type === UNKNOWN_TYPE),
  );

  if (byName !== undefined) {
    return { kind: "name", entityId: byName.id };
  }

  if (subject.type === UNKNOWN_TYPE) {
    return { kind: "new" };
  }

  let best: { entityId: string; similarity: number } | undefined;

  for (const entity of roots) {
    const similarity = entity.type === subject.type ? similarityTo(entity.id) : undefined;

    if (
      similarity !== undefined &&
      similarity >= ENTITY_SIMILARITY_THRESHOLD &&
      (best === undefined || similarity > best.similarity)
    ) {
      best = { entityId: entity.id, similarity };
    }
  }

  return best === undefined ? { kind: "new" } : { kind: "meaning", ...best };
};
