/**
 * Reads what the extension recorded — sessions, graph — and the tab groups as
 * the extension sees them, so a spec can assert on the database rather than on
 * what a surface chooses to show; and seeds state a spec cannot reach by clicking.
 *
 * This file is the public surface and holds no logic.
 */

export { type ResearchSnapshot, parseResearchSnapshot } from "./parseResearchSnapshot";
export { putResearchRecords } from "./putResearchRecords";
export { readResearchDatabase } from "./readResearchDatabase";
export { runInReaderPage } from "./runInReaderPage";
