/**
 * Splits a pooled output tensor into one vector per input text.
 *
 * The runtime returns every embedding in a single flat buffer, so the rows have
 * to be cut apart before anything can be compared. Each row is copied rather
 * than viewed: a view would keep the whole batch's buffer alive for as long as
 * any one vector is held, which for a large batch means holding megabytes to
 * keep a few kilobytes.
 *
 * The length check is not a formality. A mismatch means the model did not
 * produce the dimensionality its manifest declares, and vectors of the wrong
 * width would be compared against correctly-sized ones later, where the error
 * is unattributable.
 *
 * @throws when the buffer does not hold exactly the expected number of values.
 */
export const splitEmbeddingRows = (
  data: Float32Array,
  rows: number,
  dimensions: number,
): Float32Array[] => {
  const expected = rows * dimensions;

  if (data.length !== expected) {
    throw new Error(
      `Expected ${expected} values for ${rows} embeddings of ${dimensions} dimensions, ` +
        `but the model returned ${data.length}.`,
    );
  }

  return Array.from({ length: rows }, (_unused, row) =>
    data.slice(row * dimensions, (row + 1) * dimensions),
  );
};
