/**
 * Drives the background-lifetime probe (spike M0-1): shortens Firefox's idle
 * timeout for the event page, starts probe runs from the options page's
 * Developer card, and reads how they went. This file is the public surface and
 * holds no logic.
 */

export { type ProbeRun, parseProbeRuns } from "./parseProbeRuns";
export { readLifetimeProbes } from "./readLifetimeProbes";
export { setBackgroundIdleTimeout } from "./setBackgroundIdleTimeout";
export { startLifetimeProbe } from "./startLifetimeProbe";
