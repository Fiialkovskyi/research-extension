/** How long to wait for the surface to answer, which includes starting the worker. */
export const SURFACE_TIMEOUT_MS = 30_000;

/**
 * How long a network install may take.
 *
 * Generous on purpose: it covers fetching tens of megabytes over whatever
 * connection the machine has, and a tight bound here would report a slow
 * network as a broken add-on.
 */
export const INSTALL_TIMEOUT_MS = 600_000;

/**
 * How long loading a model and embedding a batch may take.
 *
 * The software path is single-threaded, which is the whole point of measuring
 * it, so this has to tolerate a result that turns out to be slow.
 */
export const INFERENCE_TIMEOUT_MS = 600_000;

/** Test ids the surface exposes, kept in one place so a rename breaks one file. */
export const CAPABILITIES_TEST_ID = "capabilities";
export const SURFACE_TEST_ID = "options-app";
export const EMPTY_LIST_TEST_ID = "model-list-empty";
export const MODEL_LIST_TEST_ID = "model-list";
export const PROBE_LIST_TEST_ID = "probe-list";
export const BENCHMARK_TEST_ID = "benchmark-report";
export const POLICY_TEST_ID = "policy-report";
export const PROBLEM_TEST_ID = "options-problem";
export const INSTALLED_TEST_ID = "install-installed";
export const INSTALL_FAILED_TEST_ID = "install-failed";
