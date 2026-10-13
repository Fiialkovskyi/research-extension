import * as v from "valibot";

/** `GET /api/tags`: the models Ollama has pulled. */
export const ollamaTagsSchema = v.object({
  models: v.array(
    v.object({
      name: v.string(),
      digest: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
      size: v.number(),
      details: v.optional(
        v.object({
          family: v.optional(v.string()),
          quantization_level: v.optional(v.string()),
        }),
      ),
    }),
  ),
});

/** `POST /api/show`: a model's architecture details. */
export const ollamaShowSchema = v.object({
  license: v.optional(v.string()),
  /** What the model can do, such as `embedding` or `completion`; absent before Ollama 0.6. */
  capabilities: v.optional(v.array(v.string())),
  model_info: v.record(v.string(), v.unknown()),
  details: v.optional(v.object({ quantization_level: v.optional(v.string()) })),
});

/** `POST /api/embed`: one vector per input. */
export const ollamaEmbedSchema = v.object({
  embeddings: v.array(v.array(v.number())),
});

/** One line of `POST /api/chat`'s stream: a piece of the answer, and how it ended on the last. */
export const ollamaChatLineSchema = v.object({
  message: v.optional(v.object({ content: v.string() })),
  done: v.optional(v.boolean()),
  /** `stop` when the model finished, `length` when it reached `num_predict`. */
  done_reason: v.optional(v.string()),
  error: v.optional(v.string()),
});

/** One line of `POST /api/pull`'s progress stream. */
export const ollamaPullLineSchema = v.object({
  status: v.string(),
  total: v.optional(v.number()),
  completed: v.optional(v.number()),
  error: v.optional(v.string()),
});

/** A model Ollama has, or one the add-on recommends getting, as the options page shows it. */
export const ollamaModelEntrySchema = v.object({
  name: v.string(),
  family: v.picklist(["embedding", "text-generation", "unknown"]),
  /** Whether Ollama has it; a recommended model it lacks can be downloaded. */
  isPulled: v.boolean(),
  isRecommended: v.boolean(),
  /** Ollama's size when pulled, else the profile's estimate. */
  size: v.string(),
  /** The installed model's ref once registered. */
  registeredRef: v.nullable(v.string()),
  isActive: v.boolean(),
});

export const ollamaRequestSchemas = {
  /** Where the local server stands, and what it has. */
  "ollama.status": v.object({}),
  /** Record a model Ollama has, inactive until it passes conformance. */
  "ollama.register": v.object({ name: v.string() }),
  /** Have Ollama download a model from its registry; progress streams over a port. */
  "ollama.pull": v.object({ name: v.string() }),
  /** Download if missing, register, check and activate, in one action from the user's click. */
  "ollama.enable": v.object({ name: v.string() }),
  /** Whether local AI is paused because the server it needs is not answering. */
  "ollama.health": v.object({}),
} as const;

export const ollamaResponseSchemas = {
  "ollama.state": v.object({
    state: v.picklist(["notConnected", "unreachable", "refused", "running"]),
    models: v.array(ollamaModelEntrySchema),
  }),
  "ollama.registered": v.object({ name: v.string(), ref: v.string() }),
  "ollama.registerFailed": v.object({ name: v.string(), reason: v.string() }),
  "ollama.pullProgress": v.object({
    name: v.string(),
    status: v.string(),
    completed: v.optional(v.number()),
    total: v.optional(v.number()),
  }),
  "ollama.pulled": v.object({ name: v.string() }),
  "ollama.pullFailed": v.object({ name: v.string(), reason: v.string() }),
  "ollama.healthReport": v.object({ isPaused: v.boolean() }),
  "ollama.enableProgress": v.object({
    name: v.string(),
    stage: v.picklist(["downloading", "checking"]),
    percent: v.optional(v.number()),
  }),
  "ollama.enabled": v.object({ name: v.string(), ref: v.string() }),
  "ollama.enableFailed": v.object({
    name: v.string(),
    stage: v.picklist(["downloading", "checking"]),
    reason: v.string(),
  }),
} as const;
