/**
 * Where the built page observer lands in the package. WXT builds a runtime
 * content script to `content-scripts/<name>.js`; the background injects it by
 * this path into each session tab.
 */
export const PAGE_OBSERVER_PATH = "/content-scripts/pageObserver.js";

/**
 * Where the built blocked-site notice script lands. It is injected only into a
 * session tab that shows a page of a denylisted site, to draw one notice.
 */
export const BLOCKED_NOTICE_PATH = "/content-scripts/blockedNotice.js";

/** The longest a page holds observations before sending them (REQ-CAP-005). */
export const SIGNAL_FLUSH_INTERVAL_MS = 2_000;

/**
 * The host access a page observer needs: every page, since a session can visit
 * any. Required in the manifest and granted at install; the popup asks again
 * only when the user revoked it.
 */
export const PAGE_ACCESS_ORIGINS = ["<all_urls>"];
