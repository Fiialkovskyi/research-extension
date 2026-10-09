/**
 * Euclidean length of a vector.
 *
 * Used to check that a model actually normalizes when its contract says it
 * does. Similarity thresholds elsewhere are chosen assuming unit length, so a
 * model that declares normalization and does not deliver it would make every
 * one of those thresholds mean something different.
 */
export const getVectorNorm = (vector: Float32Array): number => {
  let sum = 0;

  for (const value of vector) {
    sum += value * value;
  }

  return Math.sqrt(sum);
};
