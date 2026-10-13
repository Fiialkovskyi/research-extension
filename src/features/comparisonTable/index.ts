/**
 * The generic comparison table (REQ-SYN-005..007): a session's entities of one
 * type against their commonest attributes, each cell a value chosen from the
 * facts with every source, conflicts between sources flagged, and the whole
 * exportable as CSV with its provenance. Computed from facts when read; no
 * model runs.
 */

// `ui/` is deliberately absent from this barrel: the background imports
// feature barrels and has no use for React. Surfaces import components by path.

export { MAXIMUM_PROPOSED_COLUMNS, VALUE_TOLERANCE } from "./constants";
export {
  comparisonTableRequestSchemas,
  comparisonTableResponseSchemas,
  comparisonTableSchema,
} from "./schemas";
export type { ComparisonCell, ComparisonColumn, ComparisonTable, ValueGroup } from "./types";
export { buildComparisonCsv } from "./model/buildComparisonCsv";
export { type ComparisonTableView, readComparisonTable } from "./model/readComparisonTable";
export { saveTableColumns } from "./model/saveTableColumns";
