/**
 * The nearest-rank percentile of some measurements: the smallest value that at
 * least `percentile` per cent of them do not exceed.
 *
 * @throws With no measurements.
 */
export const getPercentile = (values: readonly number[], percentile: number): number => {
  if (values.length === 0) {
    throw new Error("No measurements to take a percentile of.");
  }

  const sorted = values.toSorted((first, second) => first - second);
  const rank = Math.max(1, Math.ceil((percentile / 100) * sorted.length));

  return sorted[rank - 1] as number;
};
