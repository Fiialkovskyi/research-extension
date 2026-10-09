/**
 * Cosine similarity between two vectors.
 *
 * Computed from the dot product and both norms rather than assuming unit
 * length, because one of the probes exists precisely to find out whether the
 * vectors are normalized. Assuming it here would make that probe unable to fail.
 *
 * @throws when the vectors are of different widths, which means at least one
 *   does not match the contract and comparing them would produce a number that
 *   looks meaningful.
 */
export const getCosineSimilarity = (left: Float32Array, right: Float32Array): number => {
  if (left.length !== right.length) {
    throw new Error(
      `Cannot compare a ${left.length}-dimensional vector with a ${right.length}-dimensional one.`,
    );
  }

  let dot = 0;
  let leftSum = 0;
  let rightSum = 0;

  for (const [index, leftValue] of left.entries()) {
    const rightValue = right[index] ?? 0;

    dot += leftValue * rightValue;
    leftSum += leftValue * leftValue;
    rightSum += rightValue * rightValue;
  }

  const magnitude = Math.sqrt(leftSum) * Math.sqrt(rightSum);

  // Two zero vectors are not similar; they are uninformative. Reporting zero
  // keeps a degenerate model from scoring well on the ordering probe.
  return magnitude === 0 ? 0 : dot / magnitude;
};
