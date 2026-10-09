import type * as v from "valibot";

import type { InferenceDevice, ModelManifest } from "@/shared/modelManifest";

import type {
  inferenceRequestSchemas,
  inferenceResponseSchemas,
  workerRequestSchemas,
  workerResponseSchemas,
} from "./schemas";

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
