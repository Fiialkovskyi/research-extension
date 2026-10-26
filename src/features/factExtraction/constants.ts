import factExtractionInstructions from "./prompts/factExtraction@2.md?raw";
import factExtractionJsonSchema from "./prompts/factExtraction@2.schema.json";

/**
 * The fact-extraction prompt (REQ-SYN-010): its id and version, which every
 * fact records, the instruction text and the JSON schema its answer follows.
 * Changing either file means a new version and new files beside these.
 */
export const FACT_EXTRACTION_PROMPT = {
  id: "factExtraction",
  version: 2,
  instructions: factExtractionInstructions,
  jsonSchema: factExtractionJsonSchema,
} as const;

/** The most facts one chunk's answer may hold; the schemas carry the same bound. */
export const MAXIMUM_FACTS_PER_CHUNK = 12;

/** The job that extracts one snapshot's facts. */
export const EXTRACT_FACTS_JOB = "extractFacts";

/** Below embedding, which the map and reattach need first. */
export const EXTRACT_FACTS_PRIORITY = -10;

/** The answer's token limit: twelve facts with their quotes, and room to close the JSON. */
export const FACT_ANSWER_MAX_TOKENS = 1_024;

/**
 * The context one request needs: the instructions, a ~220-word chunk and the
 * answer fit well inside it. Sent explicitly so a model configured with less
 * behaves the same.
 */
export const FACT_CONTEXT_TOKENS = 4_096;

/** The delimiters page text travels between (REQ-SYN-011). */
export const PAGE_TEXT_OPEN = "<page_text>";
export const PAGE_TEXT_CLOSE = "</page_text>";

/** The delimiters the page's own description travels between: data too, and cut short. */
export const PAGE_CONTEXT_OPEN = "<page_context>";
export const PAGE_CONTEXT_CLOSE = "</page_context>";
export const PAGE_CONTEXT_FIELD_LIMIT = 200;

/** The type of a subject the answer did not list, and of facts stored before types were kept. */
export const UNKNOWN_ENTITY_TYPE = "unknown";

/** What produced a fact the page's own data gave, as its provenance records it; no model read it. */
export const PRODUCT_DATA_PROMPT = "productData@1";
export const PRODUCT_DATA_MODEL = "page data";

/** The type of the subject of a fact made from a page's product data. */
export const PRODUCT_ENTITY_TYPE = "product";

/** Where a fact made from a page's product data says it came from. */
export const PRODUCT_DATA_QUOTE_PREFIX = "From the page's data: ";
