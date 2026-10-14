/**
 * Records every HTTP request the add-on triggers, so a run can assert it
 * reached nowhere (REQ-SEC-001 to SEC-003). Each function is a directory of its
 * own with its unit test beside it. This file is the public surface and holds
 * no logic.
 */

export { type EgressRequest, parseEgressLog } from "./parseEgressLog";
export { findExtensionEgress } from "./findExtensionEgress";
export { probeEgress } from "./probeEgress";
export { readEgressLog } from "./readEgressLog";
export { startEgressLog } from "./startEgressLog";
