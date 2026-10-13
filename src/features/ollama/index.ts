/**
 * Ollama: a local inference server the user runs, which serves embeddings
 * (and, after the spike's gate, generation) on the machine's own hardware. The
 * add-on reaches it on loopback only, once the user grants access, and treats
 * its models like installed ones: pinned, checked by the conformance suite,
 * then activated.
 */

export { LOCAL_SERVER_FAILURE_PATTERN, OLLAMA_STATUS_TIMEOUT_MS } from "./constants";
export { ollamaRequestSchemas, ollamaResponseSchemas } from "./schemas";
export type { OllamaFetch, OllamaModel, OllamaModelEntry } from "./types";
export { buildOllamaManifest } from "./model/buildOllamaManifest";
export { buildOllamaOriginsCommand } from "./model/buildOllamaOriginsCommand";
export type { OllamaOriginsCommand, OllamaPlatform } from "./model/buildOllamaOriginsCommand";
export { createOllamaEmbedder } from "./model/createOllamaEmbedder";
export { createOllamaGenerator } from "./model/createOllamaGenerator";
export type { OllamaGenerator } from "./model/createOllamaGenerator";
export { isLocalAiPaused } from "./model/isLocalAiPaused";
export { findOllamaProfile } from "./model/findOllamaProfile";
export { listOllamaModelEntries } from "./model/listOllamaModelEntries";
export { matchesOllamaName } from "./model/matchesOllamaName";
export type { OllamaEmbedder } from "./model/createOllamaEmbedder";
export { pullOllamaModel } from "./model/pullOllamaModel";
export { requeuePausedJobs } from "./model/requeuePausedJobs";
export type { OllamaPullProgress } from "./model/pullOllamaModel";
export { readOllamaStatus } from "./model/readOllamaStatus";
export type { OllamaStatus } from "./model/readOllamaStatus";
