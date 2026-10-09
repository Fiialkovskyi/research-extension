import { isFirefoxPackage } from "../isFirefoxPackage";

/**
 * Returns the single Firefox package in a directory listing.
 *
 * Kept free of the filesystem so the interesting cases — nothing built, one
 * build, several stale builds — are cheap to cover.
 *
 * @param entries Filenames in the build output directory.
 * @param directoryLabel Directory to name in error messages.
 * @throws If no package is present, or if more than one is, since picking
 *   arbitrarily would silently test a stale build.
 */
export const selectFirefoxPackage = (
  entries: readonly string[],
  directoryLabel: string,
): string => {
  const [candidate, ...extras] = entries.filter(isFirefoxPackage);

  if (candidate === undefined) {
    throw new Error(
      `No Firefox package found in ${directoryLabel} (looked for *firefox*.zip). ` +
        'Run "npm run zip:firefox" before the e2e suite.',
    );
  }

  if (extras.length > 0) {
    throw new Error(
      `Expected one Firefox package in ${directoryLabel}, found ${extras.length + 1}: ` +
        `${[candidate, ...extras].join(", ")}. Remove stale builds with "rm -rf .output".`,
    );
  }

  return candidate;
};
