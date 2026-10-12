/**
 * Where the built page observer lands in the package. WXT builds a runtime
 * content script to `content-scripts/<name>.js`; the background injects it by
 * this path into each session tab.
 */
export const PAGE_OBSERVER_PATH = "/content-scripts/pageObserver.js";

/** The longest a page holds observations before sending them (REQ-CAP-005). */
export const SIGNAL_FLUSH_INTERVAL_MS = 2_000;

/**
 * The host access a page observer needs: every page, since a session can visit
 * any. Optional in the manifest and asked for when a session starts.
 */
export const PAGE_ACCESS_ORIGINS = ["<all_urls>"];
