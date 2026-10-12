import { SEMANTIC_THRESHOLD, SEMANTIC_WEIGHT_SCALE } from "../../../../constants";

/** Page vectors of one embedding space, by node id. */
export interface SemanticInput {
  spaceId: string;
  vectors: ReadonlyMap<string, Float32Array>;
}

/** A copy of the vector scaled to unit length; a zero vector stays zero. */
const toUnitLength = (vector: Float32Array): Float64Array => {
  const unit = Float64Array.from(vector);
  let squares = 0;

  for (const value of unit) {
    squares += value * value;
  }

  const length = Math.sqrt(squares);

  if (length > 0) {
    for (let index = 0; index < unit.length; index += 1) {
      unit[index] = (unit[index] as number) / length;
    }
  }

  return unit;
};

/** The dot product of two vectors of equal length. */
const dot = (first: Float64Array, second: Float64Array): number => {
  let sum = 0;

  for (let index = 0; index < first.length; index += 1) {
    sum += (first[index] as number) * (second[index] as number);
  }

  return sum;
};

/** An edge between two pages for clustering, and how much it weighs. */
export interface WeightedPair {
  from: string;
  to: string;
  weight: number;
}

/**
 * Joins pages whose content is similar (REQ-CLU-002): every pair of the given
 * pages that both have a vector, at or above the threshold, weighted by how
 * far above it they are. Pages without a vector join nothing.
 *
 * The input holds the vectors of one space only, which is what makes their
 * similarities meaningful; vectors of two spaces cannot be passed together.
 *
 * At a session's few hundred pages this is tens of thousands of pairs, so each
 * vector is scaled to unit length once and a pair's similarity is a plain dot
 * product — the cosine, without recomputing two norms per pair.
 *
 * @param memberIds The pages taking part, in a fixed order, which fixes the
 *   order of the pairs.
 */
export const buildSemanticEdges = (
  memberIds: readonly string[],
  { vectors }: SemanticInput,
): WeightedPair[] => {
  const withVectors = memberIds.flatMap((id) => {
    const vector = vectors.get(id);

    return vector === undefined ? [] : [{ id, vector: toUnitLength(vector) }];
  });
  const pairs: WeightedPair[] = [];

  for (let first = 0; first < withVectors.length; first += 1) {
    for (let second = first + 1; second < withVectors.length; second += 1) {
      const a = withVectors[first];
      const b = withVectors[second];

      if (a !== undefined && b !== undefined) {
        const similarity = dot(a.vector, b.vector);

        if (similarity >= SEMANTIC_THRESHOLD) {
          pairs.push({
            from: a.id,
            to: b.id,
            weight:
              (SEMANTIC_WEIGHT_SCALE * (similarity - SEMANTIC_THRESHOLD)) /
              (1 - SEMANTIC_THRESHOLD),
          });
        }
      }
    }
  }

  return pairs;
};
