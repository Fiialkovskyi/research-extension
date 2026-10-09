import * as v from "valibot";

/**
 * What a model is, as the add-on records it.
 *
 * The shape comes from the target spec's model abstraction layer rather than
 * from any one function, and it is read by the persistence layer, the registry,
 * the installer and the inference provider alike — so it lives here rather than
 * beside one of them. Validation schemas sit next to the types because a
 * manifest crosses a trust boundary twice: it is derived from files fetched
 * over the network, and it is read back out of storage.
 */

/** Model families the add-on can use. Optional families from the spec arrive with their features. */
export const MODEL_FAMILIES = ["embedding", "text-generation"] as const;

/** Compute paths a provider can report actually having used. */
export const INFERENCE_DEVICES = ["webgpu", "wasm", "cpu"] as const;

/**
 * How a file's expected digest was obtained.
 *
 * The hub publishes a SHA-256 only for files held in large-file storage — the
 * model weights. Small files such as `config.json` and `tokenizer.json` are
 * ordinary git objects, for which the only published hash is the git object
 * hash over their contents. Recording which algorithm applies keeps the
 * manifest from claiming a SHA-256 it never had, while still letting every
 * file be verified before it is loaded.
 */
export const fileDigestSchema = v.variant("algorithm", [
  v.object({
    algorithm: v.literal("sha256"),
    value: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/, "Expected a SHA-256 digest")),
  }),
  v.object({
    algorithm: v.literal("git-blob-sha1"),
    value: v.pipe(v.string(), v.regex(/^[0-9a-f]{40}$/, "Expected a git object hash")),
  }),
]);

/** A 40-character commit identifier. Branch names are resolved to one at install time. */
export const commitRevisionSchema = v.pipe(
  v.string(),
  v.regex(/^[0-9a-f]{40}$/, "Expected a 40-character commit identifier"),
);

export const modelReferenceSchema = v.object({
  hub: v.literal("huggingface"),
  repository: v.pipe(v.string(), v.regex(/^[^/\s]+\/[^/\s]+$/, "Expected owner/name")),
  revision: commitRevisionSchema,
});

export const embeddingContractSchema = v.object({
  family: v.literal("embedding"),
  dimensions: v.pipe(v.number(), v.integer(), v.minValue(1)),
  maxInputTokens: v.pipe(v.number(), v.integer(), v.minValue(1)),
  pooling: v.picklist(["mean", "cls", "last_token"]),
  normalize: v.boolean(),
  similarity: v.picklist(["cosine", "dot"]),
  /** Empty strings where the model needs no prefix, so callers never branch on absence. */
  prefixes: v.object({ query: v.string(), document: v.string() }),
});

export const textGenerationContractSchema = v.object({
  family: v.literal("text-generation"),
  contextWindow: v.pipe(v.number(), v.integer(), v.minValue(1)),
  maxNewTokens: v.pipe(v.number(), v.integer(), v.minValue(1)),
  chatTemplate: v.union([v.literal("from_tokenizer_config"), v.string()]),
  /**
   * Whether the runtime can constrain output to a schema. Declared honestly:
   * where it cannot, generated output is validated and discarded on failure
   * rather than trusted.
   */
  structuredOutput: v.picklist(["json_schema", "grammar", "none"]),
});

export const modelContractSchema = v.variant("family", [
  embeddingContractSchema,
  textGenerationContractSchema,
]);

export const modelFileSchema = v.object({
  path: v.pipe(v.string(), v.minLength(1)),
  digest: fileDigestSchema,
  bytes: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export const modelManifestSchema = v.object({
  manifestVersion: v.literal(1),
  reference: modelReferenceSchema,
  format: v.picklist(["onnx"]),
  quantization: v.optional(v.string()),
  files: v.pipe(v.array(modelFileSchema), v.minLength(1)),
  /** SPDX identifier from the model card, recorded so licensing is traceable. */
  license: v.string(),
  contract: modelContractSchema,
});

export type ModelFamily = (typeof MODEL_FAMILIES)[number];
export type InferenceDevice = (typeof INFERENCE_DEVICES)[number];
export type ModelReference = v.InferOutput<typeof modelReferenceSchema>;
export type EmbeddingContract = v.InferOutput<typeof embeddingContractSchema>;
export type TextGenerationContract = v.InferOutput<typeof textGenerationContractSchema>;
export type ModelContract = v.InferOutput<typeof modelContractSchema>;
export type FileDigest = v.InferOutput<typeof fileDigestSchema>;
export type ModelFile = v.InferOutput<typeof modelFileSchema>;
export type ModelManifest = v.InferOutput<typeof modelManifestSchema>;
