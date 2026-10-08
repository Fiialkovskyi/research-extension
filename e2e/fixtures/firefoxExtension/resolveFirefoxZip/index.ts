import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { OUTPUT_DIR, PACKAGE_OVERRIDE_ENV } from "../constants";
import { selectFirefoxPackage } from "../selectFirefoxPackage";

/**
 * Seams the unit tests replace. Production callers pass nothing and get the
 * real filesystem and environment.
 */
export interface ResolveFirefoxZipOptions {
  /** Directory to search. Defaults to the project's `.output`. */
  outputDirectory?: string;
  /** Explicit package path. Defaults to the override environment variable. */
  override?: string | undefined;
  /** Directory listing function. Defaults to a synchronous `readdir`. */
  listDirectory?: (directory: string) => string[];
}

/**
 * Locates the packaged Firefox build the e2e suite should install.
 *
 * Resolution order:
 *
 * 1. An explicit path in `E2E_EXTENSION_ZIP`. This is the escape hatch for
 *    driving a build other than the packaged production one — the dev-server
 *    build, for instance — without changing the suite.
 * 2. The single `*firefox*.zip` in `.output`, written by `npm run zip:firefox`.
 *
 * @throws If the output directory cannot be read, or if it does not hold
 *   exactly one Firefox package.
 */
export function resolveFirefoxZip(options: ResolveFirefoxZipOptions = {}): string {
  const {
    outputDirectory = OUTPUT_DIR,
    listDirectory = (directory: string) => readdirSync(directory),
  } = options;
  // Distinguishes "no override key at all" (read the live environment, the
  // production default) from an explicit `override: undefined` (the unit
  // tests' way of saying "no override, and don't go near the environment
  // either") — a destructured default cannot tell the two apart, since both
  // see `undefined`.
  const override = "override" in options ? options.override : process.env[PACKAGE_OVERRIDE_ENV];

  if (override !== undefined && override !== "") {
    return resolve(override);
  }

  let entries: string[];

  try {
    entries = listDirectory(outputDirectory);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }

    throw new Error(
      `No build output at ${outputDirectory}. Run "npm run zip:firefox" before the e2e suite.`,
      { cause: err },
    );
  }

  return join(outputDirectory, selectFirefoxPackage(entries, outputDirectory));
}
