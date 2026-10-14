/**
 * The activity log: when each page of a session was read, copied from and
 * pasted into, kept so the map can draw the session as a timeline.
 *
 * Times and pages only. The page's text, what was copied and what was pasted
 * are never part of a record, so the log cannot accumulate content.
 */

export { readSessionActivity } from "./model/readSessionActivity";
export { recordFocusInterval } from "./model/recordFocusInterval";
export type { FocusInterval } from "./model/recordFocusInterval";
export { recordPageMarks } from "./model/recordPageMarks";
export type { PageMarks } from "./model/recordPageMarks";
