/**
 * The research library: keeping a session saved as the user goes
 * (REQ-STO-003), the saved sessions (REQ-STO-004), and resuming one where the
 * user left off (REQ-STO-005).
 *
 * The library list is not exported here; the popup imports it from `ui/` by
 * path, so nothing that imports this barrel bundles React.
 */

export { TAB_RECORD_DELAY_MS, TAB_RECORD_MAX_WAIT_MS } from "./constants";
export {
  researchLibraryRequestSchemas,
  researchLibraryResponseSchemas,
  savedSessionSummarySchema,
} from "./schemas";
export type { SavedSessionSummary } from "./types";
export { declineReattach } from "./model/declineReattach";
export { findReattachCandidate } from "./model/findReattachCandidate";
export type {
  FindReattachCandidateOptions,
  ReattachCandidate,
} from "./model/findReattachCandidate";
export { reattachSession } from "./model/reattachSession";
export type { ReattachSessionOptions } from "./model/reattachSession";
export { listSavedSessions } from "./model/listSavedSessions";
export { resumeSession } from "./model/resumeSession";
export type { ResumeApi, ResumeSessionOptions } from "./model/resumeSession";
export { recordSessionTabs } from "./model/recordSessionTabs";
export type { RecordSessionTabsOptions } from "./model/recordSessionTabs";
export { suggestReattach } from "./model/suggestReattach";
