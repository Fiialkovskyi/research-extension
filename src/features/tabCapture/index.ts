/**
 * Capture: turns what happens in the session's tabs into the research graph.
 *
 * A tab is in the session if and only if it is in the session's tab group. A
 * page committed in such a tab becomes a node, linked to the tab's previous
 * page and, for a tab's first page, to the page that opened it. Leaving the
 * group or closing the tab closes the node; it is never deleted for that.
 *
 * Every function reads the active session itself, so nothing about capture
 * lives only in the memory of an event page that may be unloaded.
 */

export { CAPTURE_EDGE_WEIGHTS } from "./constants";
export type { CaptureTab, CommittedNavigation, TabCaptureApi } from "./types";
export { buildPageFields } from "./model/buildPageFields";
export type { PageFields } from "./model/buildPageFields";
export { closeTabNode } from "./model/closeTabNode";
export { followTabMembership } from "./model/followTabMembership";
export { isCapturableUrl } from "./model/isCapturableUrl";
export { readBlockedHost } from "./model/readBlockedHost";
export { readBlockedNavigation } from "./model/readBlockedNavigation";
export type { BlockedNavigation } from "./model/readBlockedNavigation";
export { linkRefinement } from "./model/linkRefinement";
export { readCaptureTab } from "./model/readCaptureTab";
export { readFocusedTab } from "./model/readFocusedTab";
export type { FocusApi } from "./model/readFocusedTab";
export { reconcileSessionTabs } from "./model/reconcileSessionTabs";
export { recordNavigation } from "./model/recordNavigation";
export { readSearchEngine } from "./model/readSearchEngine";
export { readSearchQuery } from "./model/readSearchQuery";
export { recordTabFocus } from "./model/recordTabFocus";
export { trackActiveDwell } from "./model/trackActiveDwell";
export type { TrackActiveDwellOptions, TrackedDwell } from "./model/trackActiveDwell";
export { updateTabTitle } from "./model/updateTabTitle";
