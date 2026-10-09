/** Shape Firefox requires of the UUID it maps an add-on id onto. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Reports whether a string is a lowercase canonical UUID.
 *
 * Firefox silently ignores a malformed `extensions.webextensions.uuids` entry
 * and falls back to a random UUID, which surfaces much later as a popup that
 * cannot be found. Validating turns that into a fast, explicit failure.
 */
export const isCanonicalUuid = (value: string): boolean => {
  return UUID_PATTERN.test(value);
};
