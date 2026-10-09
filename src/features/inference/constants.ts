import * as v from "valibot";

import {
  INFERENCE_DEVICES,
  type InferenceDevice,
  type ModelManifest,
  modelManifestSchema,
} from "../../shared/modelManifest";

/**
 * The protocol between the background and the inference worker.
 *
 * Both sides validate against these schemas, so a shape mismatch surfaces as a
 * refused message rather than as a confusing failure deeper in the runtime.
 */

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

export const workerRequestSchemas = {
  /**
   * Liveness and capability probe. Answered before any model is loaded, so the
   * worker can be shown to be running independently of a model install.
   */
  "worker.ping": v.object({}),
  /**
   * Load a model from files the background already verified.
   *
   * The bytes travel with the message rather than being read by the worker:
   * storage belongs to the background, and the buffers transfer without a copy.
   */
  "model.load": v.object({
    manifest: modelManifestSchema,
    files: v.array(
      v.object({ path: v.pipe(v.string(), v.minLength(1)), contents: v.instance(ArrayBuffer) }),
    ),
    device: v.picklist(INFERENCE_DEVICES),
  }),
  /** Embed a batch of texts with the currently loaded model. */
  "infer.embed": v.object({
    texts: v.array(v.string()),
    role: v.picklist(["query", "document"]),
  }),
} as const;

export const workerResponseSchemas = {
  "worker.pong": v.object({
    /** Compute paths this worker can actually reach, as the runtime reports them. */
    availableDevices: v.array(v.picklist(INFERENCE_DEVICES)),
    /**
     * Whether the worker's realm is cross-origin isolated. Expected to be false
     * in a Firefox extension, which is what forces single-threaded WebAssembly.
     */
    crossOriginIsolated: v.boolean(),
    /** Threads the runtime will actually use, which isolation decides. */
    threadCount: v.pipe(v.number(), v.integer(), v.minValue(1)),
  }),
  "model.loaded": v.object({
    device: v.picklist(INFERENCE_DEVICES),
    /** Present for an embedding model; a generative model reports none. */
    dimensions: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
    loadDurationMs: v.pipe(v.number(), v.minValue(0)),
  }),
  "infer.embedded": v.object({
    vectors: v.array(v.instance(Float32Array)),
    device: v.picklist(INFERENCE_DEVICES),
    durationMs: v.pipe(v.number(), v.minValue(0)),
  }),
  /** A request the worker could not complete, carrying a reason for the caller. */
  "worker.error": v.object({
    requestType: v.string(),
    reason: v.string(),
  }),
} as const;

/**
 * Messages a surface sends to the background, and what comes back.
 *
 * A surface never talks to the worker directly: the background owns it, so the
 * surface asks the background and the background decides how the work is done.
 */
export const inferenceRequestSchemas = {
  /** Ask what this installation can actually run, before any model exists. */
  "inference.probe": v.object({}),
} as const;

export const inferenceResponseSchemas = {
  "inference.capabilities": v.object({
    availableDevices: v.array(v.picklist(INFERENCE_DEVICES)),
    crossOriginIsolated: v.boolean(),
    threadCount: v.pipe(v.number(), v.integer(), v.minValue(1)),
  }),
  /** A request the background could not satisfy, with a reason for the surface. */
  "inference.failed": v.object({ reason: v.string() }),
} as const;

export type InferenceRequestType = keyof typeof inferenceRequestSchemas;
export type InferenceResponseType = keyof typeof inferenceResponseSchemas;
/**
 * The contract every inference provider honours.
 *
 * Declared here rather than beside the implementation on purpose: the
 * implementation imports the model runtime, and the background needs these
 * types to describe its messages without paying to load WebAssembly. Shaped for
 * both families from the start, so the generation side does not force a rewrite
 * of an interface designed around batches of vectors.
 */

/** A text's role, which decides the prefix a model's contract applies. */
export type EmbeddingRole = "query" | "document";

export interface EmbedRequest {
  texts: readonly string[];
  role: EmbeddingRole;
}

export interface EmbedResult {
  vectors: Float32Array[];
  /** The device that actually produced these, which can differ per run. */
  device: InferenceDevice;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateRequest {
  messages: readonly ChatMessage[];
  maxTokens: number;
  temperature?: number;
  /** Cancels the run; the stream ends and the runtime is released. */
  signal?: AbortSignal;
}

export interface GenerateResult {
  text: string;
  device: InferenceDevice;
  stoppedBecause: "token-limit" | "model" | "cancelled";
}

export interface GenerationStream extends AsyncIterable<{ delta: string }> {
  final: () => Promise<GenerateResult>;
}

/** A model in memory, discriminated by what it can actually do. */
export type LoadedModel =
  | {
      family: "embedding";
      manifest: ModelManifest;
      device: InferenceDevice;
      embed: (request: EmbedRequest) => Promise<EmbedResult>;
      unload: () => Promise<void>;
    }
  | {
      family: "text-generation";
      manifest: ModelManifest;
      device: InferenceDevice;
      generate: (request: GenerateRequest) => GenerationStream;
      unload: () => Promise<void>;
    };

export type WorkerRequestType = keyof typeof workerRequestSchemas;
export type WorkerResponseType = keyof typeof workerResponseSchemas;
export type WorkerPong = v.InferOutput<(typeof workerResponseSchemas)["worker.pong"]>;
