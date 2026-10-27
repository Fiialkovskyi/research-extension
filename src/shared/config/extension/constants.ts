/**
 * Identity of the packaged extension.
 *
 * Single source of truth: the Firefox manifest (`wxt.config.ts`) and the e2e
 * harness both read these values, so the add-on id cannot drift between the
 * package and the test that addresses the popup by URL.
 */

/** Stable add-on id declared under `browser_specific_settings.gecko.id`. */
export const EXTENSION_ID = "research-graph@researchgraph.app";

/** Minimum supported Firefox, per the target spec (Firefox ESR 140). */
export const FIREFOX_MIN_VERSION = "140.0";

/** Path of the toolbar action's popup document inside the package. */
export const POPUP_PATH = "popup.html";

/** Path of the options document inside the package, where models are managed. */
export const OPTIONS_PATH = "options.html";

/**
 * Query parameter that pins a page (map, recorded data, summaries) to one
 * session: `map.html?session=<id>`. A page without it follows the viewed session.
 */
export const SESSION_QUERY_PARAMETER = "session";
