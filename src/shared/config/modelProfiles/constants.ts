import type { ModelFamily } from "../../modelManifest";
import type { ModelProfile } from "./types";

/**
 * Bundled model profiles: known-good models, pinned to a commit.
 *
 * A profile carries only what a repository does not declare about itself.
 * Dimensionality and token limits are read from the model's own configuration
 * files; pooling, normalization, the similarity metric and the role prefixes
 * are not published in any machine-readable form, so they are recorded here and
 * verified by the conformance suite rather than guessed at install time.
 *
 * Every revision is a 40-character commit. A profile naming a branch would make
 * the add-on's behaviour depend on when it was installed.
 */

/** Files every transformers.js text model needs beside its weights. */
const TOKENIZER_FILES = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "special_tokens_map.json",
] as const;

/**
 * Default embedding profile: smallest thing that does the job.
 *
 * 384 dimensions, mean pooling, no role prefixes, and about 23 MB quantized —
 * comfortably inside the 150 MB footprint budget, with a short enough download
 * to keep the development loop tight.
 */
export const MINILM_L6_V2: ModelProfile = {
  repository: "Xenova/all-MiniLM-L6-v2",
  revision: "751bff37182d3f1213fa05d7196b954e230abad9",
  quantization: "q8",
  files: [...TOKENIZER_FILES, "onnx/model_quantized.onnx"],
  license: "Apache-2.0",
  contract: {
    family: "embedding",
    pooling: "mean",
    normalize: true,
    similarity: "cosine",
    prefixes: { query: "", document: "" },
  },
};

/**
 * Second embedding profile, carried to prove the registry is not wired to one
 * model.
 *
 * Chosen for its asymmetric prefixes: the query side takes an instruction and
 * the document side takes none, which is the part of the embedding contract the
 * default profile cannot exercise at all. About 34 MB quantized, so it tests
 * that without a large download.
 */
export const BGE_SMALL_EN_V1_5: ModelProfile = {
  repository: "Xenova/bge-small-en-v1.5",
  revision: "ea104dacec62c0de699686887e3f920caeb4f3e3",
  quantization: "q8",
  files: [...TOKENIZER_FILES, "onnx/model_quantized.onnx"],
  // The hub publishes no license field for this mirror; the upstream BAAI
  // model is MIT-licensed.
  license: "MIT",
  contract: {
    family: "embedding",
    pooling: "cls",
    normalize: true,
    similarity: "cosine",
    prefixes: {
      query: "Represent this sentence for searching relevant passages: ",
      document: "",
    },
  },
};

export const BUNDLED_MODEL_PROFILES = [MINILM_L6_V2, BGE_SMALL_EN_V1_5] as const;

/** The profile a fresh installation offers first, per family. */
export const DEFAULT_PROFILE_BY_FAMILY: Partial<Record<ModelFamily, ModelProfile>> = {
  embedding: MINILM_L6_V2,
};
