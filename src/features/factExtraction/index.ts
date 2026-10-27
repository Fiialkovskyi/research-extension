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
  FACT_ANSWER_MAX_TOKENS,
  FACT_CONTEXT_TOKENS,
  FACT_EXTRACTION_PROMPT,
  MAXIMUM_FACTS_PER_CHUNK,
  PRODUCT_DATA_PROMPT,
  PRODUCT_ENTITY_TYPE,
  UNKNOWN_ENTITY_TYPE,
} from "./constants";
export {
  extractFactsPayloadSchema,
  factExtractionRequestSchemas,
  factExtractionResponseSchemas,
} from "./schemas";
export type { ExtractedFact, ExtractFactsPayload, FactExtractionAnswer, SealedFact } from "./types";
export { buildFactExtractionMessages } from "./model/buildFactExtractionMessages";
export { buildProductFacts } from "./model/buildProductFacts";
export { enqueueFactExtractions } from "./model/enqueueFactExtractions";
export { getFactProducerVersion } from "./model/getFactProducerVersion";
export { isImplausibleSubject } from "./model/isImplausibleSubject";
export { isQuoteGrounded } from "./model/isQuoteGrounded";
export { repairSubject } from "./model/repairSubject";
export { tidyFacts } from "./model/tidyFacts";
export { readFactAnswer } from "./model/readFactAnswer";
export { readSealedFact } from "./model/readSealedFact";
export {
  runFactExtractionJob,
  type RunFactExtractionJobOptions,
} from "./model/runFactExtractionJob";
