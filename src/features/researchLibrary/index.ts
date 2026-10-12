/**
 * The research library: saving a session to come back to (REQ-STO-003), the
 * saved sessions (REQ-STO-004), and resuming one where the user left off
 * (REQ-STO-005).
 *
 * The library list is not exported here; the popup imports it from `ui/` by
 * path, so nothing that imports this barrel bundles React.
 */

export { SAVE_FLUSH_TIMEOUT_MS } from "./constants";
export {
  researchLibraryRequestSchemas,
  researchLibraryResponseSchemas,
  savedSessionSummarySchema,
} from "./schemas";
export type { SavedSessionSummary } from "./types";
export { closeTabsKeepingWindow } from "./model/closeTabsKeepingWindow";
export type { CloseTabsApi } from "./model/closeTabsKeepingWindow";
export { listSavedSessions } from "./model/listSavedSessions";
export { resumeSession } from "./model/resumeSession";
export type { ResumeApi, ResumeSessionOptions } from "./model/resumeSession";
export { saveActiveSession } from "./model/saveActiveSession";
export type { SavedSession, SaveActiveSessionOptions } from "./model/saveActiveSession";
