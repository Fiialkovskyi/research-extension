const UNITS: Readonly<Record<string, number>> = { KB: 1e3, MB: 1e6, GB: 1e9 };

/**
 * Reads a size a profile states for people, such as `274 MB` or `2.5 GB`, as
 * bytes; `0` for anything it cannot read, so an odd entry never blocks setup.
 */
export const parseApproximateSize = (size: string): number => {
  const match = /^\s*(\d+(?:\.\d+)?)\s*(KB|MB|GB)\s*$/iu.exec(size);
  const unit = match?.[2] === undefined ? undefined : UNITS[match[2].toUpperCase()];

  return match?.[1] === undefined || unit === undefined ? 0 : Math.round(Number(match[1]) * unit);
};
