/** The earliest publication date taken as real; a page saying earlier has a wrong clock. */
const EARLIEST_PUBLISHED_AT = Date.UTC(1990, 0, 1);

/**
 * Reads a publication time as a page wrote it. Pages write dates every way, so
 * only what `Date.parse` understands counts, and only when it is plausible: not
 * before 1990 and not after `now`, since a wrong clock on a page should not
 * claim to be the newest source.
 *
 * @returns The time in epoch milliseconds and its calendar date in UTC
 *   (`2026-05-01`), or `undefined` when the value does not parse or is not
 *   plausible.
 */
export const parsePublishedDate = (
  value: string,
  now: number,
): { time: number; date: string } | undefined => {
  const time = Date.parse(value);

  if (Number.isNaN(time) || time < EARLIEST_PUBLISHED_AT || time > now) {
    return undefined;
  }

  return { time, date: new Date(time).toISOString().slice(0, 10) };
};
