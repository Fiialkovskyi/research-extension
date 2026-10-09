/** Thresholds and labels, largest first, so the first match is the right unit. */
const UNITS = [
  { threshold: 1_000_000_000, suffix: "GB" },
  { threshold: 1_000_000, suffix: "MB" },
  { threshold: 1_000, suffix: "kB" },
] as const;

/**
 * Renders a byte count the way a person reads disk use.
 *
 * Decimal units rather than binary ones, because that is what the hub reports
 * sizes in and a model listed as 23 MB there should not appear as 21.9 MB here.
 * One decimal place: enough to distinguish two quantizations of the same model,
 * not enough to suggest a precision that a cache and a filesystem do not share.
 */
export const getReadableSize = (bytes: number): string => {
  for (const { threshold, suffix } of UNITS) {
    if (bytes >= threshold) {
      return `${(bytes / threshold).toFixed(1)} ${suffix}`;
    }
  }

  return `${bytes} B`;
};
