/** Embedding behaviour a repository does not declare about itself. */
export interface EmbeddingProfileContract {
  family: "embedding";
  pooling: "mean" | "cls" | "last_token";
  normalize: boolean;
  similarity: "cosine" | "dot";
  /**
   * Empty strings where the model wants no prefix, so callers never branch on
   * absence. Asymmetric prefixes are normal: several models instruct the query
   * side only.
   */
  prefixes: { query: string; document: string };
}

/** Text-generation behaviour a repository does not declare about itself. */
export interface TextGenerationProfileContract {
  family: "text-generation";
  maxNewTokens: number;
  chatTemplate: "from_tokenizer_config" | string;
  structuredOutput: "json_schema" | "grammar" | "none";
}

export interface ModelProfile {
  repository: string;
  /** Pinned commit. Never a branch. */
  revision: string;
  /** Weight variant to install, matching the file named in {@link files}. */
  quantization: string;
  /**
   * Exactly the files to install. Listed rather than discovered: a repository
   * holds every quantization it ever published, and installing all of them
   * would cost hundreds of megabytes to use one.
   */
  files: readonly string[];
  /**
   * SPDX identifier. Taken from the model card where the hub publishes one and
   * recorded here otherwise, because a manifest must always be able to say
   * under what terms the weights were obtained.
   */
  license: string;
  contract: EmbeddingProfileContract | TextGenerationProfileContract;
}
