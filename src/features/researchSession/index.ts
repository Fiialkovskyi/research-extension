/**
 * The research session: which tab group is being researched, kept in the
 * database so it outlives the background event page and a browser restart.
 *
 * Until after the MVP at most one session is active or closed. It follows its
 * group: a rename renames it, the group's removal closes it, and the group
 * coming back reopens it. Its tabs carry its id as a per-tab session value, so
 * a tab the user restores after the group is gone is brought back into the
 * session. The group itself is created by `tabGroups`; this feature records
 * and follows it.
 */

export { NO_TAB_GROUP, SESSION_TAB_VALUE_KEY } from "./constants";
export { researchSessionRequestSchemas, researchSessionResponseSchemas } from "./schemas";
export type {
  ResearchSessionRequestType,
  ResearchSessionResponseType,
  SessionSummary,
  SessionTab,
  SessionTabApi,
} from "./types";
export { buildSessionSummary } from "./model/buildSessionSummary";
export { closeSessionForGroup } from "./model/closeSessionForGroup";
export { createSession } from "./model/createSession";
export type { CreateSessionOptions } from "./model/createSession";
export { getActiveSession } from "./model/getActiveSession";
export { getLiveSession } from "./model/getLiveSession";
export { reconcileActiveSession } from "./model/reconcileActiveSession";
export type { ReconcileActiveSessionOptions } from "./model/reconcileActiveSession";
export { rekeySession } from "./model/rekeySession";
export { renameSessionForGroup } from "./model/renameSessionForGroup";
export { reopenSessionForGroup } from "./model/reopenSessionForGroup";
export { restoreSessionTab } from "./model/restoreSessionTab";
export type { RestoredTabOutcome, RestoreSessionTabOptions } from "./model/restoreSessionTab";
export { startSession } from "./model/startSession";
export type { StartedSession, StartSessionOptions } from "./model/startSession";
export { trackSessionTabMembership } from "./model/trackSessionTabMembership";
export type { TrackSessionTabMembershipOptions } from "./model/trackSessionTabMembership";
