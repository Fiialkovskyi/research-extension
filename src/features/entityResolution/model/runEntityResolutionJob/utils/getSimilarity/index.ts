/** The cosine similarity of two vectors of the same length. */
export const getSimilarity = (first: Float32Array, second: Float32Array): number => {
  let dot = 0;
  let firstNorm = 0;
  let secondNorm = 0;

  for (let index = 0; index < first.length; index += 1) {
    const a = first[index] ?? 0;
    const b = second[index] ?? 0;

    dot += a * b;
    firstNorm += a * a;
    secondNorm += b * b;
  }

  return firstNorm === 0 || secondNorm === 0 ? 0 : dot / Math.sqrt(firstNorm * secondNorm);
};
