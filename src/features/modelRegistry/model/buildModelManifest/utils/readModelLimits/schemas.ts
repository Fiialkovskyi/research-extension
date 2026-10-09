import * as v from "valibot";

const positiveInteger = v.pipe(v.number(), v.integer(), v.minValue(1));

export const configSchema = v.looseObject({
  hidden_size: v.optional(positiveInteger),
  max_position_embeddings: v.optional(positiveInteger),
});

export const tokenizerConfigSchema = v.looseObject({
  model_max_length: v.optional(v.pipe(v.number(), v.minValue(1))),
});
