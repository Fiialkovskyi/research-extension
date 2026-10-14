/**
 * Measures what the target spec budgets (REQ-NFR-001, NFR-003) in the running
 * browser. Each function is a directory of its own with its unit test beside
 * it. This file is the public surface and holds no logic.
 */

export { getPercentile } from "./getPercentile";
export { parseProcessMemory } from "./parseProcessMemory";
export { readExtensionProcessMemory } from "./readExtensionProcessMemory";
