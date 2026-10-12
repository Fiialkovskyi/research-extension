/**
 * Does to a session's tab group what a person does with the tab strip: opens a
 * page in it, closes it in one of Firefox's several ways, and restores it with
 * Ctrl+Shift+T.
 *
 * Everything here runs in Firefox's chrome context. The Firefox internals it
 * relies on are named in `constants.ts`. This file is the public surface and
 * holds no logic.
 */

export { openPageInGroup } from "./openPageInGroup";
export { runChromeAfterFlush } from "./runChromeAfterFlush";
export { type PageServer, startPageServer } from "./startPageServer";
export { undoCloseTab } from "./undoCloseTab";
