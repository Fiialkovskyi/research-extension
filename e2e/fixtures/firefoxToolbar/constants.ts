/**
 * Firefox internals this fixture depends on, gathered in one place.
 *
 * These are not public API: they are ids, class names and protocol keys that a
 * Firefox release can rename. Keeping them together means such a change is one
 * edit here rather than a hunt through the fixture, and makes the extent of
 * the coupling visible at a glance.
 */

/**
 * The W3C WebDriver key under which an element reference is passed. Needed
 * because the toolbar click is issued through the classic protocol, where
 * element references are raw JSON rather than WebdriverIO element objects.
 */
export const ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf";

/** CSS selector for the XUL `<browser>` that hosts an extension popup. */
export const POPUP_BROWSER_SELECTOR = "browser.webextension-popup-browser";

/** DOM id of the panel Firefox opens for a toolbar widget's popup. */
export const POPUP_PANEL_ID = "customizationui-widget-panel";

/**
 * Firefox's two Marionette contexts. Only the lowercase spellings are
 * accepted: `"CHROME"` is rejected outright with "unknown variant".
 */
export const CHROME_CONTEXT = "chrome";
export const CONTENT_CONTEXT = "content";

/** Area id Firefox uses for the navigation toolbar. */
export const NAV_BAR_AREA = "nav-bar";

/** State Firefox reports for a panel that has finished opening. */
export const PANEL_OPEN = "open";

/** Prefix the popup reader uses to hand an actor failure back as a string. */
export const ACTOR_ERROR_PREFIX = "ERROR ";

/** Preference Firefox reads to decide the system colour scheme it reports. */
export const DARK_THEME_PREF = "ui.systemUsesDarkTheme";

/** How long any wait on the browser's UI may take before it is a failure. */
export const UI_TIMEOUT_MS = 10_000;

/**
 * Module that flushes tab state to the session store. Saving a group reads
 * that state, and in a test it is still pending moments after a page loads,
 * so the group would be saved empty without a flush first.
 */
export const TAB_STATE_FLUSHER_MODULE =
  "moz-src:///browser/components/sessionstore/TabStateFlusher.sys.mjs";
