/**
 * Writes a length of time the way the map labels it: `45s` under a minute,
 * `7m` under an hour, `1h 5m` beyond.
 */
export const formatDuration = (milliseconds: number): string => {
  const seconds = Math.round(Math.max(0, milliseconds) / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
};
