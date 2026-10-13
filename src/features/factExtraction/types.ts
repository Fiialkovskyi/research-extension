import type * as v from "valibot";

import type {
  extractFactsCheckpointSchema,
  extractFactsPayloadSchema,
  factExtractionAnswerSchema,
  sealedFactSchema,
} from "./schemas";

export type FactExtractionAnswer = v.InferOutput<typeof factExtractionAnswerSchema>;
export type ExtractedFact = FactExtractionAnswer["facts"][number];
export type ExtractFactsPayload = v.InferOutput<typeof extractFactsPayloadSchema>;
export type ExtractFactsCheckpoint = v.InferOutput<typeof extractFactsCheckpointSchema>;
export type SealedFact = v.InferOutput<typeof sealedFactSchema>;
