/**
 * Firefox internals the session-restore fixture depends on. Not public API: a
 * Firefox release can move them, as it already moved this module from
 * `resource:///modules/sessionstore/`.
 */

/** Firefox's module that pushes each tab's pending session history to the parent. */
export const TAB_STATE_FLUSHER_MODULE =
  "moz-src:///browser/components/sessionstore/TabStateFlusher.sys.mjs";

/** How long a page opened in a group may take to finish loading. */
export const PAGE_LOAD_TIMEOUT_MS = 10_000;
