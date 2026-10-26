import { getCosineSimilarity } from "@/shared/getCosineSimilarity";
import { normalizeEntityName } from "@/shared/normalizeEntityName";

import { CONCEPT_EMBEDDING_BATCH_SIZE, CONCEPT_SIMILARITY_THRESHOLD } from "./constants";

/** Embeds short labels; the caller says which model. */
export type EmbedConcepts = (texts: readonly string[]) => Promise<Float32Array[]>;

/** Embeds the distinct concepts, a batch at a time; `undefined` when anything is missing. */
const embedAll = async (
  concepts: readonly string[],
  embed: EmbedConcepts,
): Promise<Map<string, Float32Array> | undefined> => {
  const vectors = new Map<string, Float32Array>();

  try {
    for (let start = 0; start < concepts.length; start += CONCEPT_EMBEDDING_BATCH_SIZE) {
      const batch = concepts.slice(start, start + CONCEPT_EMBEDDING_BATCH_SIZE);
      const embedded = await embed(batch);

      for (const [index, concept] of batch.entries()) {
        const vector = embedded[index];

        if (vector === undefined) {
          return undefined;
        }

        vectors.set(concept, vector);
      }
    }
  } catch {
    return undefined;
  }

  return vectors;
};

/**
 * Gives each concept the key of the column it belongs to. Concepts equal after
 * normalisation share a key; with `embed`, a concept also joins the commonest
 * concept whose embedding is at least {@link CONCEPT_SIMILARITY_THRESHOLD}
 * similar, and only through such a representative, so a chain of near
 * neighbours cannot drift into one column. Without `embed`, or when it fails,
 * only the equal ones merge. Nothing but the concept labels is embedded, and no
 * list of products, attributes or languages is consulted.
 *
 * `concepts` is every concept of the facts, repeats included: how often one
 * occurs decides which is the representative, then alphabetical order.
 *
 * @returns Each concept as given, to its column key.
 */
export const resolveConceptKeys = async (
  concepts: readonly string[],
  embed?: EmbedConcepts,
): Promise<Map<string, string>> => {
  const counts = new Map<string, number>();

  for (const concept of concepts) {
    const normalised = normalizeEntityName(concept);

    counts.set(normalised, (counts.get(normalised) ?? 0) + 1);
  }

  const distinct = [...counts.keys()].toSorted(
    (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b),
  );
  const vectors = embed === undefined ? undefined : await embedAll(distinct, embed);
  const representatives: string[] = [];
  const keyOf = new Map<string, string>();

  for (const concept of distinct) {
    const vector = vectors?.get(concept);
    const nearest =
      vector === undefined
        ? undefined
        : representatives
            .map((representative) => ({
              representative,
              similarity: getCosineSimilarity(vector, vectors?.get(representative) ?? vector),
            }))
            .filter(({ similarity }) => similarity >= CONCEPT_SIMILARITY_THRESHOLD)
            .toSorted((a, b) => b.similarity - a.similarity)[0];

    if (nearest === undefined) {
      representatives.push(concept);
      keyOf.set(concept, concept);
    } else {
      keyOf.set(concept, nearest.representative);
    }
  }

  return new Map(
    [...new Set(concepts)].map((concept) => [
      concept,
      keyOf.get(normalizeEntityName(concept)) ?? normalizeEntityName(concept),
    ]),
  );
};
