import { EXTENSION_ID } from "@/shared/config/extension";
import { PINNED_EXTENSION_UUID } from "../constants";
import { isCanonicalUuid } from "../isCanonicalUuid";

/**
 * Firefox profile preferences the e2e session starts with.
 *
 * Two settings matter, and both exist only to make an unsigned local build
 * testable:
 *
 * - `extensions.webextensions.uuids` maps the add-on id onto a known UUID, so
 *   the popup's `moz-extension://` address is predictable (see `extension-uuid`).
 * - `xpinstall.signatures.required` disables the signature requirement. The
 *   suite installs temporarily, which already bypasses it, but an unsigned
 *   build must not be blocked if a future test installs permanently.
 */
export interface ProfilePreferences {
  "extensions.webextensions.uuids": string;
  "xpinstall.signatures.required": boolean;
}

/**
 * Builds the preference set for one add-on id and UUID.
 *
 * The UUID is validated here rather than at the point of use: Firefox ignores a
 * malformed mapping without complaint and falls back to a random UUID, which
 * would surface much later as an unreachable popup.
 *
 * @throws If the UUID is not a canonical lowercase UUID.
 */
export function buildProfilePreferences(
  extensionId: string = EXTENSION_ID,
  uuid: string = PINNED_EXTENSION_UUID,
): ProfilePreferences {
  if (!isCanonicalUuid(uuid)) {
    throw new Error(
      `"${uuid}" is not a canonical lowercase UUID; Firefox would ignore the mapping ` +
        "and assign a random one, leaving the popup at an unknown address.",
    );
  }

  return {
    "extensions.webextensions.uuids": JSON.stringify({ [extensionId]: uuid }),
    "xpinstall.signatures.required": false,
  };
}
