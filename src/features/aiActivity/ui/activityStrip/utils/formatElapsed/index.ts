/**
 * Writes how long a job has run, to the second, so a timer visibly ticks:
 * `40s` under a minute, `2m 05s` beyond.
 */
export const formatElapsed = (milliseconds: number): string => {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
};
