/**
 * Gets this extension installed in Firefox: which package to install, the
 * profile preferences that make an unsigned local build loadable and its
 * popup addressable, and how to address a document inside it.
 *
 * Driving the extension once it is installed is a separate concern and lives
 * in `../firefoxToolbar`.
 *
 * Each function is a directory of its own with its unit test beside it;
 * helpers private to one function sit flat beside it and stay out of this barrel, and
 * values shared across the fixture are in `constants.ts`. This file is the
 * public surface and holds no logic.
 */

export {
  type FirefoxCapabilityOptions,
  RESTART_PREFERENCES,
  buildFirefoxCapabilities,
} from "./buildFirefoxCapabilities";
export { grantPageAccess } from "./grantPageAccess";
export { revokePageAccess } from "./revokePageAccess";
export { isCanonicalUuid } from "./isCanonicalUuid";
export { getExtensionUrl } from "./getExtensionUrl";
export { type ProfilePreferences, buildProfilePreferences } from "./buildProfilePreferences";
export { type ReadPackageOptions, readFirefoxZipAsBase64 } from "./readFirefoxZipAsBase64";
export { type ResolveFirefoxZipOptions, resolveFirefoxZip } from "./resolveFirefoxZip";
export { restartFirefox } from "./restartFirefox";
export { selectFirefoxPackage } from "./selectFirefoxPackage";
