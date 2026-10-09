/**
 * Running a model: the worker that hosts it, the protocol for talking to it,
 * and the contract every provider honours.
 *
 * Step 5 of the pipeline. The background reads verified files out of
 * storage and hands them to the worker, which loads them into the runtime and
 * answers embedding requests. Nothing here fetches anything: by the time a byte
 * reaches the runtime it has already been checked against a manifest.
 *
 * Two things are deliberately absent from this barrel. `model/createExtOrtProvider`
 * is imported by path from the worker instead, because re-exporting it would
 * pull the whole model runtime into every bundle that touches this feature —
 * the background included, which needs only the types. And there is no second
 * provider yet; when the native host arrives it implements the same
 * `InferenceProvider` contract and slots in beside it.
 */

export {
  INFERENCE_REQUEST_TIMEOUT_MS,
  INFERENCE_WORKER_PATH,
  SUPPORTED_QUANTIZATIONS,
} from "./constants";
export {
  inferenceRequestSchemas,
  inferenceResponseSchemas,
  workerRequestSchemas,
  workerResponseSchemas,
} from "./schemas";
export type {
  ChatMessage,
  EmbedRequest,
  EmbedResult,
  EmbeddingRole,
  GenerateRequest,
  GenerateResult,
  GenerationStream,
  InferenceRequestType,
  InferenceResponseType,
  LoadedModel,
  WorkerPong,
  WorkerRequestType,
  WorkerResponseType,
} from "./types";
export { createInferenceWorker } from "./model/createInferenceWorker";
export type { InferenceWorker } from "./model/createInferenceWorker";
// `model/createExtOrtProvider` is deliberately absent from this barrel: it
// imports the model runtime, and anything that re-exports it drags tens of
// megabytes into every bundle that touches this feature — the background
// included, which needs only the protocol types. The worker imports it by
// path, so the cost lands in the one context that runs models.
export { createModelFileCache } from "./model/createModelFileCache";
export type { ModelFileContents } from "./model/createModelFileCache";
export { getAvailableDevices } from "./model/getAvailableDevices";
export { loadModelIntoWorker } from "./model/loadModelIntoWorker";
export type { WorkerModelSession } from "./model/loadModelIntoWorker";
export { getOnnxRuntimeWasmPaths } from "./model/getOnnxRuntimeWasmPaths";
export { getRuntimeCapabilities } from "./model/getRuntimeCapabilities";
export type { RuntimeCapabilities } from "./model/getRuntimeCapabilities";
