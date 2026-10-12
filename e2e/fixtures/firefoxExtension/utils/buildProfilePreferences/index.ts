import { EXTENSION_ID } from "@/shared/config";
import { DENYLISTED_TEST_HOST, SEARCH_HOSTS } from "../../../pageServer/constants";
import { PINNED_EXTENSION_UUID } from "../../constants";
import { isCanonicalUuid } from "../isCanonicalUuid";

/**
 * Firefox profile preferences the e2e session starts with.
 *
 * Two settings make an unsigned local build testable:
 *
 * - `extensions.webextensions.uuids` maps the add-on id onto a known UUID, so
 *   the popup's `moz-extension://` address is predictable (see `extension-uuid`).
 * - `xpinstall.signatures.required` disables the signature requirement. The
 *   suite installs temporarily, which already bypasses it, but an unsigned
 *   build must not be blocked if a future test installs permanently.
 *
 * Three more let the suite load search engine URLs offline:
 *
 * - `network.dns.localDomains` resolves the search hosts, and one denylisted
 *   host, to the loopback interface, where the page server answers them.
 * - `network.stricttransportsecurity.preloadlist` off, because the HSTS preload
 *   list would upgrade `http://duckduckgo.com` to `https`, which the local
 *   server does not speak.
 * - `dom.security.https_first` off, for the same reason: HTTPS-First would try
 *   `https` before the plain address.
 *
 * And one answers the page-access prompt a session start raises:
 *
 * - `extensions.webextOptionalPermissionPrompts` off grants an optional
 *   permission without asking, as the user clicking "Allow" would. The prompt
 *   is browser chrome a WebDriver session cannot reach reliably.
 */
export interface ProfilePreferences {
  "extensions.webextensions.uuids": string;
  "xpinstall.signatures.required": boolean;
  "network.dns.localDomains": string;
  "network.stricttransportsecurity.preloadlist": boolean;
  "dom.security.https_first": boolean;
  "extensions.webextOptionalPermissionPrompts": boolean;
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
export const buildProfilePreferences = (
  extensionId: string = EXTENSION_ID,
  uuid: string = PINNED_EXTENSION_UUID,
): ProfilePreferences => {
  if (!isCanonicalUuid(uuid)) {
    throw new Error(
      `"${uuid}" is not a canonical lowercase UUID; Firefox would ignore the mapping ` +
        "and assign a random one, leaving the popup at an unknown address.",
    );
  }

  return {
    "extensions.webextensions.uuids": JSON.stringify({ [extensionId]: uuid }),
    "xpinstall.signatures.required": false,
    "network.dns.localDomains": [...SEARCH_HOSTS, DENYLISTED_TEST_HOST].join(","),
    "network.stricttransportsecurity.preloadlist": false,
    "dom.security.https_first": false,
    "extensions.webextOptionalPermissionPrompts": false,
  };
};
