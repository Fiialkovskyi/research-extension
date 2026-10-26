/**
 * The notice a page shows when it was taken into a research session, and the
 * switch that turns it off.
 */

// `ui/` and `model/showPageNotice` are deliberately absent from this barrel:
// the background imports feature barrels and has no use for React or the DOM.
// The options page imports the toggle by path, and the page observer imports
// `showPageNotice` by path.

export { pageNoticeRequestSchemas, pageNoticeResponseSchemas } from "./schemas";
export type { PageNoticeStatus } from "./types";
export { isPageNoticeEnabled } from "./model/isPageNoticeEnabled";
export { setPageNoticeEnabled } from "./model/setPageNoticeEnabled";
