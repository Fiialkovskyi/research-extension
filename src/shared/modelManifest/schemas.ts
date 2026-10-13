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

/** A model downloaded from the Hugging Face hub, pinned to a commit. */
export const huggingFaceReferenceSchema = v.object({
  hub: v.literal("huggingface"),
  repository: v.pipe(v.string(), v.regex(/^[^/\s]+\/[^/\s]+$/, "Expected owner/name")),
  revision: commitRevisionSchema,
});

/**
 * A model served by a local Ollama server, pinned to the content digest Ollama
 * reports for it: a model re-pulled under the same name is a different model.
 */
export const ollamaReferenceSchema = v.object({
  hub: v.literal("ollama"),
  /** Ollama's model name with its tag, such as `nomic-embed-text:latest`. */
  repository: v.pipe(v.string(), v.regex(/^[^\s]+$/, "Expected an Ollama model name")),
  revision: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/, "Expected a SHA-256 digest")),
});

export const modelReferenceSchema = v.variant("hub", [
  huggingFaceReferenceSchema,
  ollamaReferenceSchema,
]);

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

export const modelManifestSchema = v.pipe(
  v.object({
    manifestVersion: v.literal(1),
    reference: modelReferenceSchema,
    /** `local-server` for a model a local server runs, whose files the add-on never holds. */
    format: v.picklist(["onnx", "local-server"]),
    quantization: v.optional(v.string()),
    files: v.array(modelFileSchema),
    /** SPDX identifier from the model card, recorded so licensing is traceable. */
    license: v.string(),
    contract: modelContractSchema,
  }),
  v.check(
    (manifest) =>
      manifest.reference.hub === "ollama"
        ? manifest.format === "local-server" && manifest.files.length === 0
        : manifest.format === "onnx" && manifest.files.length > 0,
    "A downloaded model is ONNX with files; a local server's model has none",
  ),
);
