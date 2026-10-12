/**
 * Recorded data: what a session recorded, shown to the user, and deleted on
 * request with everything derived from it (REQ-SEC-008, REQ-STO-008).
 *
 * The components are not exported here; the page and the popup import them
 * from `ui/` by path, so nothing that imports this barrel bundles React.
 */

export { RECORDED_PAGE_PATH } from "./constants";
export {
  recordedDataRequestSchemas,
  recordedDataResponseSchemas,
  recordedSessionSchema,
} from "./schemas";
export type { RecordedPage, RecordedSession } from "./types";
export { deleteNode } from "./model/deleteNode";
export { deleteSession } from "./model/deleteSession";
export { readRecordedSession } from "./model/readRecordedSession";
export { readRecordedText } from "./model/readRecordedText";
