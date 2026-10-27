import * as v from "valibot";

import { MAXIMUM_FACTS_PER_CHUNK, UNKNOWN_ENTITY_TYPE } from "./constants";

/**
 * A `factExtraction@4` answer, as it must be before anything is stored.
 * Mirrors `prompts/factExtraction@4.schema.json`, which is what the model is
 * asked to follow; `constants.spec.ts` keeps the two in step.
 */
export const factExtractionAnswerSchema = v.object({
  entities: v.array(
    v.object({
      name: v.string(),
      entity_type: v.string(),
    }),
  ),
  facts: v.pipe(
    v.array(
      v.object({
        subject: v.string(),
        attribute: v.string(),
        /** The attribute as a short English noun phrase, the same for the same thing in any language. */
        concept: v.pipe(v.string(), v.maxLength(40)),
        value: v.string(),
        unit: v.optional(v.string()),
        quote: v.string(),
      }),
    ),
    v.maxLength(MAXIMUM_FACTS_PER_CHUNK),
  ),
});

/** What an extraction job works on. */
export const extractFactsPayloadSchema = v.object({
  snapshotId: v.string(),
  /** Set when the user asked for extraction; such a job runs while the user is active. */
  requestedAt: v.optional(v.number()),
});

/** Where an extraction job got to: the first chunk not yet done. */
export const extractFactsCheckpointSchema = v.object({
  nextChunk: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

/**
 * A fact's text, as it is encrypted into the store. Facts stored before the
 * subject's type was kept have none, and read as `unknown`.
 */
export const sealedFactSchema = v.object({
  subject: v.string(),
  entityType: v.optional(v.string(), UNKNOWN_ENTITY_TYPE),
  attribute: v.string(),
  /** Absent on facts stored before concepts were kept: they read as the attribute. */
  concept: v.optional(v.string()),
  value: v.string(),
  unit: v.optional(v.string()),
  quote: v.string(),
});

/**
 * Messages a surface sends about facts. `facts.extractNow` asks for the active
 * session's pages to be extracted while the user is active (REQ-MOD-008: an
 * explicit request); its answer is the session's queued extraction count.
 */
export const factExtractionRequestSchemas = {
  "facts.extractNow": v.object({ sessionId: v.optional(v.string()) }),
} as const;

export const factExtractionResponseSchemas = {
  "facts.extractionStarted": v.object({ queued: v.pipe(v.number(), v.integer(), v.minValue(0)) }),
} as const;
