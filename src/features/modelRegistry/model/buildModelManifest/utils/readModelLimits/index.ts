import * as v from "valibot";

/**
 * A length a real model could have. Some repositories record a sentinel in
 * `model_max_length` — values around 1e30 appear in the wild — which is not a
 * limit but the absence of one, and must not become a declared contract value.
 */
const PLAUSIBLE_TOKEN_LIMIT = 1_000_000;

const positiveInteger = v.pipe(v.number(), v.integer(), v.minValue(1));

const configSchema = v.looseObject({
  hidden_size: v.optional(positiveInteger),
  max_position_embeddings: v.optional(positiveInteger),
});

const tokenizerConfigSchema = v.looseObject({
  model_max_length: v.optional(v.pipe(v.number(), v.minValue(1))),
});

/** What a repository declares about its own shape, where it declares it. */
export interface ModelLimits {
  /** Output width of the encoder; an embedding model's dimensionality. */
  hiddenSize?: number;
  /** Longest position the model was trained to attend to. */
  maxPositionEmbeddings?: number;
  /** The tokenizer's own limit, where it records a plausible one. */
  modelMaxLength?: number;
}

/**
 * Reads the limits a model publishes about itself.
 *
 * Deliberately returns what it found rather than deciding anything: which of
 * these becomes `maxInputTokens` or `contextWindow` depends on the family, and
 * that decision belongs with the caller that knows the family. An implausible
 * tokenizer limit is reported as absent, because treating a sentinel as a real
 * bound would let a model claim a context it does not have.
 */
export const readModelLimits = (config: unknown, tokenizerConfig: unknown): ModelLimits => {
  const parsedConfig = v.safeParse(configSchema, config);
  const parsedTokenizer = v.safeParse(tokenizerConfigSchema, tokenizerConfig);

  const modelMaxLength = parsedTokenizer.success
    ? parsedTokenizer.output.model_max_length
    : undefined;

  return {
    hiddenSize: parsedConfig.success ? parsedConfig.output.hidden_size : undefined,
    maxPositionEmbeddings: parsedConfig.success
      ? parsedConfig.output.max_position_embeddings
      : undefined,
    modelMaxLength:
      modelMaxLength !== undefined &&
      Number.isInteger(modelMaxLength) &&
      modelMaxLength <= PLAUSIBLE_TOKEN_LIMIT
        ? modelMaxLength
        : undefined,
  };
};
