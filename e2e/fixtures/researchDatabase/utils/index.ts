/**
 * Reads what the extension recorded — sessions, graph — and the tab groups as
 * the extension sees them, so a spec can assert on the database rather than on
 * what a surface chooses to show.
 *
 * This file is the public surface and holds no logic.
 */

export { type ResearchSnapshot, parseResearchSnapshot } from "./parseResearchSnapshot";
export { readResearchDatabase } from "./readResearchDatabase";
