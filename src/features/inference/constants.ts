/**
 * Weight variants the model runtime can load, mirroring its own data types.
 *
 * Kept as our own list rather than imported from the library: importing it
 * would pull the whole runtime into any module that merely validates a
 * profile, including unit tests that have no business loading WebAssembly.
 */
export const SUPPORTED_QUANTIZATIONS = [
  "fp32",
  "fp16",
  "q8",
  "int8",
  "uint8",
  "q4",
  "bnb4",
  "q4f16",
] as const;

/** Path of the built worker script inside the package. */
export const INFERENCE_WORKER_PATH = "/inferenceWorker.js";

/** How long a worker request may take before the caller gives up. */
export const INFERENCE_REQUEST_TIMEOUT_MS = 120_000;
