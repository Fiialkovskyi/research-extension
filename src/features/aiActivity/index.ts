/**
 * What the extension tells the user about the local model's background work:
 * whether it is working, waiting, paused or done, and how far it has got.
 */

// `ui/` is deliberately absent from this barrel: the background imports
// feature barrels and has no use for React. Surfaces import components by path.

export { aiActivityRequestSchemas, aiActivityResponseSchemas } from "./schemas";
export type { ActivityState, SessionTotals } from "./types";
export { type ActivityConditions, getActivityState } from "./model/getActivityState";
export { getWorkLabel } from "./model/getWorkLabel";
