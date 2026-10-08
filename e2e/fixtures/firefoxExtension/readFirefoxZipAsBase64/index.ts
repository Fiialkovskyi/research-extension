import { readFileSync } from "node:fs";

import { type ResolveFirefoxZipOptions, resolveFirefoxZip } from "../resolveFirefoxZip";

/** Seams the unit tests replace; production callers pass nothing. */
export interface ReadPackageOptions extends ResolveFirefoxZipOptions {
  /** File reader. Defaults to a synchronous read of the whole file. */
  readFile?: (path: string) => Buffer;
}

/**
 * Reads the packaged build in the form WebDriver wants.
 *
 * geckodriver's add-on install endpoint takes the archive as a base64 string
 * rather than a path, because the driver may be running on another machine.
 * Packages here are well under a megabyte, so reading one into memory is
 * cheaper than streaming it.
 */
export function readFirefoxZipAsBase64(options: ReadPackageOptions = {}): string {
  const { readFile = (path: string) => readFileSync(path), ...resolveOptions } = options;

  return readFile(resolveFirefoxZip(resolveOptions)).toString("base64");
}
