import clusterSummaryInstructions from "./prompts/clusterSummary@2.md?raw";
import clusterSummaryJsonSchema from "./prompts/clusterSummary@2.schema.json";

/**
 * The cluster-summary prompt (REQ-SYN-010): its id and version, which every
 * summary records, the instruction text and the JSON schema its answer
 * follows. Changing either file means a new version beside these.
 */
export const CLUSTER_SUMMARY_PROMPT = {
  id: "clusterSummary",
  version: 2,
  instructions: clusterSummaryInstructions,
  jsonSchema: clusterSummaryJsonSchema,
} as const;

/** The most statements a summary holds (REQ-SYN-003); the schemas carry the same bound. */
export const MAXIMUM_SUMMARY_STATEMENTS = 8;

/** The most facts one summary is built from. */
export const MAXIMUM_SUMMARY_FACTS = 60;

/** The job that summarises one cluster. */
export const SUMMARIZE_CLUSTER_JOB = "summarizeCluster";

/** How long a cluster's fact set must settle before it is summarised (REQ-SYN-004). */
export const SUMMARY_DEBOUNCE_MS = 60_000;

/** The answer's token limit: eight short claims with their labels. */
export const SUMMARY_ANSWER_MAX_TOKENS = 1_024;

/** Sixty facts, the instructions and the answer need more than Ollama's default 4,096. */
export const SUMMARY_CONTEXT_TOKENS = 8_192;

/** The delimiters the facts travel between (REQ-SYN-011). */
export const FACTS_OPEN = "<facts>";
export const FACTS_CLOSE = "</facts>";

/** The page that shows summaries. */
export const SUMMARIES_PAGE_PATH = "/summaries.html";

/** Below fact extraction: a summary is only as good as the facts it is built from. */
export const SUMMARIZE_CLUSTER_PRIORITY = -20;

/**
 * What a shopper compares first, as attribute column keys (`getAttributeKey`):
 * facts in these are chosen for a summary, and shown on a product card, before
 * the rest, the earlier the more important.
 */
export const KEY_SPEC_ORDER = [
  "screen size",
  "display",
  "battery capacity",
  "storage",
  "ram",
  "main camera",
  "processor",
  "charging",
  "weight",
  "water resistance",
] as const;

/** How much less a product's next fact counts than its last: so no product takes every slot. */
export const FACT_POSITION_PENALTY = 5;

/** What a cluster's cards show: the most products, the fewest facts a product needs, the most key specs. */
export const MAXIMUM_PRODUCT_CARDS = 6;
export const MINIMUM_CARD_FACTS = 3;
export const MAXIMUM_CARD_SPECS = 5;

/** The most sources a card's value names: the pages that state it. */
export const MAXIMUM_VALUE_SOURCES = 3;

/** Attribute keys a card shows apart from its key specs, or not at all. */
export const CARD_HEADER_KEYS = ["price", "brand", "availability", "rating"] as const;
