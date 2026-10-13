/**
 * Fact extraction (M4, REQ-SYN-001/002/010/011): grounded facts from the pages
 * the user read deeply, extracted by the active text-generation model one
 * chunk at a time, kept only when their quote is on the page, and stored
 * encrypted with what produced them.
 *
 * The prompt is a versioned file under `prompts/`, with its JSON schema beside
 * it; a fact records the version, so a new prompt extracts again.
 */

export {
  EXTRACT_FACTS_JOB,
  EXTRACT_FACTS_PRIORITY,
  FACT_EXTRACTION_PROMPT,
  MAXIMUM_FACTS_PER_CHUNK,
} from "./constants";
export {
  extractFactsPayloadSchema,
  factExtractionRequestSchemas,
  factExtractionResponseSchemas,
} from "./schemas";
export type { ExtractedFact, ExtractFactsPayload, FactExtractionAnswer } from "./types";
export { buildFactExtractionMessages } from "./model/buildFactExtractionMessages";
export { enqueueFactExtractions } from "./model/enqueueFactExtractions";
export { getFactProducerVersion } from "./model/getFactProducerVersion";
export { isQuoteGrounded } from "./model/isQuoteGrounded";
export { readFactAnswer } from "./model/readFactAnswer";
export {
  runFactExtractionJob,
  type RunFactExtractionJobOptions,
} from "./model/runFactExtractionJob";
