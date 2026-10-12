import { resolve } from "node:path";

/**
 * Values shared by more than one helper in this fixture. A constant used by a
 * single helper stays in that helper's own file.
 */

/**
 * Internal UUID Firefox is forced to serve this add-on under during tests.
 *
 * Firefox mints a fresh UUID for every add-on in every profile, so the popup's
 * `moz-extension://<uuid>/popup.html` address would differ on each run and
 * could not be asserted. The e2e profile pins this value through the
 * `extensions.webextensions.uuids` preference.
 *
 * Test-only: the shipped manifest declares the add-on id and nothing else, and
 * no production code knows this constant exists.
 */
export const PINNED_EXTENSION_UUID = "8cf4bf6a-5f3a-4d5a-9f2f-2f0a1ff2ab42";

/**
 * Build output directory, resolved from this file rather than the working
 * directory, so the suite behaves the same wherever it is started from.
 */
// Resolved from this file's location: moving the file means adjusting the
// `..` segments, which `constants.spec.ts` guards against.
export const OUTPUT_DIR = resolve(import.meta.dirname, "../../../.output");

/**
 * Environment variable that points the suite at a specific package instead of
 * the one in `OUTPUT_DIR` — the escape hatch for driving the dev-server build.
 */
export const PACKAGE_OVERRIDE_ENV = "E2E_EXTENSION_ZIP";

/**
 * Whether Firefox runs without a window. `E2E_HEADED=true` shows it, to watch a
 * run; every session of the run, a restarted one included, follows it.
 */
export const HEADLESS = process.env["E2E_HEADED"] !== "true";
