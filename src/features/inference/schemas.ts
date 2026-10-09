import * as v from "valibot";

import { INFERENCE_DEVICES, modelManifestSchema } from "@/shared/modelManifest";

/**
 * The protocol between the background and the inference worker.
 *
 * Both sides validate against these schemas, so a shape mismatch surfaces as a
 * refused message rather than as a confusing failure deeper in the runtime.
 */

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
  "worker.embed": v.object({
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
  "worker.embedded": v.object({
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
