import { EmbeddingSpaceMismatchError } from "../../errors";

/** A vector with the space it belongs to. */
export interface SpacedVector {
  spaceId: string;
  vector: Float32Array;
}

/**
 * The cosine similarity of two vectors of the same space.
 *
 * @throws {EmbeddingSpaceMismatchError} When they belong to different spaces.
 */
export const compareVectors = (first: SpacedVector, second: SpacedVector): number => {
  if (first.spaceId !== second.spaceId) {
    throw new EmbeddingSpaceMismatchError(first.spaceId, second.spaceId);
  }

  let dot = 0;
  let firstNorm = 0;
  let secondNorm = 0;

  for (let index = 0; index < first.vector.length; index += 1) {
    const a = first.vector[index] ?? 0;
    const b = second.vector[index] ?? 0;

    dot += a * b;
    firstNorm += a * a;
    secondNorm += b * b;
  }

  return firstNorm === 0 || secondNorm === 0 ? 0 : dot / Math.sqrt(firstNorm * secondNorm);
};
