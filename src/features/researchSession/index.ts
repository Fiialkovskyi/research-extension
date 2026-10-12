/**
 * The research session: which tab group is being researched, kept in the
 * database so it outlives the background event page and a browser restart.
 *
 * Until after the MVP at most one session is active. It follows its group: a
 * rename renames it, and the group's removal ends it (kept as `saved`). The
 * group itself is created by `tabGroups`; this feature records and follows it.
 */

export { researchSessionRequestSchemas, researchSessionResponseSchemas } from "./schemas";
export type {
  ResearchSessionRequestType,
  ResearchSessionResponseType,
  SessionSummary,
} from "./types";
export { buildSessionSummary } from "./model/buildSessionSummary";
export { createSession } from "./model/createSession";
export type { CreateSessionOptions } from "./model/createSession";
export { endSessionForGroup } from "./model/endSessionForGroup";
export { getActiveSession } from "./model/getActiveSession";
export { reconcileActiveSession } from "./model/reconcileActiveSession";
export type { ReconcileActiveSessionOptions } from "./model/reconcileActiveSession";
export { renameSessionForGroup } from "./model/renameSessionForGroup";
export { startSession } from "./model/startSession";
export type { StartedSession, StartSessionOptions } from "./model/startSession";
