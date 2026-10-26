/**
 * Research gaps (REQ-SYN-008/009): what a session has not found yet — empty
 * comparison-table cells of entities seen on two pages, and kinds of source
 * not read, found from the pages' own data — each with a
 * search that "search this" opens inside the session's tab group.
 */

// `ui/` is deliberately absent from this barrel: the background imports
// feature barrels and has no use for React. Surfaces import components by path.

export { MAXIMUM_CELL_GAPS } from "./constants";
export { researchGapRequestSchemas, researchGapResponseSchemas } from "./schemas";
export type { ResearchGap, ResearchGaps } from "./types";
export { type GapSearchApi, openGapSearch } from "./model/openGapSearch";
export { readResearchGaps } from "./model/readResearchGaps";
