import type * as v from "valibot";

import {
  generateStructured,
  type GenerateRequest,
  type GenerationStream,
} from "@/features/inference";

import {
  EXTRACTED_TABLE_JSON_SCHEMA,
  EXTRACTION_ARTICLE,
  EXTRACTION_ARTICLE_TABLE,
  MAXIMUM_EXTRACTION_MS,
  TABLE_EXTRACTION_INSTRUCTIONS,
  TABLE_EXTRACTION_MAX_TOKENS,
} from "../../constants";
import { extractedTableSchema } from "../../schemas";

/** How long extraction from one page took, and how much of its answer was right. */
export interface ExtractionMeasurement {
  wordCount: number;
  durationMs: number;
  /** Whether the answer validated; a discarded answer is reported, not hidden. */
  isValid: boolean;
  /** Numbers the answer got right (within 1%), of those the article states. */
  correctCount: number;
  expectedCount: number;
  reason?: string;
  /** Within REQ-NFR-007's budget; an invalid answer never is, however fast. */
  meetsBudget: boolean;
}

type ExtractedRow = v.InferOutput<typeof extractedTableSchema>["products"][number];

const NUMERIC_FIELDS = ["priceUsd", "weightKg", "batteryWh", "torqueNm", "rangeKm"] as const;

/** How many of the article's numbers the extracted rows give, each matched by product name. */
const countCorrect = (rows: readonly ExtractedRow[]): number =>
  EXTRACTION_ARTICLE_TABLE.reduce((total, expected) => {
    const row = rows.find(({ name }) => name.toLowerCase().includes(expected.name.toLowerCase()));

    return (
      total +
      NUMERIC_FIELDS.filter(
        (field) =>
          row !== undefined &&
          Math.abs(row[field] - expected[field]) <= Math.abs(expected[field]) * 0.01,
      ).length
    );
  }, 0);

/**
 * Times extraction from the bundled article of about 1,500 words, the way
 * synthesis will run it: one comparison-table row per product, in a schema, at
 * temperature 0, validated afterwards — and checks the answer against what the
 * article says, since a fast wrong table is no use.
 *
 * The clock includes everything the user would wait for, the server loading
 * the model on first use included; measuring again shows the warm figure.
 *
 * @param now Reads a monotonic clock in milliseconds; injected for tests.
 * @throws What the generation throws, such as the server being away.
 */
export const measureExtractionTime = async (
  generate: (request: GenerateRequest) => GenerationStream,
  now: () => number = () => performance.now(),
): Promise<ExtractionMeasurement> => {
  const startedAt = now();
  const outcome = await generateStructured({
    generate,
    request: {
      messages: [
        { role: "system", content: TABLE_EXTRACTION_INSTRUCTIONS },
        { role: "user", content: EXTRACTION_ARTICLE },
      ],
      maxTokens: TABLE_EXTRACTION_MAX_TOKENS,
      temperature: 0,
      responseSchema: EXTRACTED_TABLE_JSON_SCHEMA,
    },
    schema: extractedTableSchema,
  });
  const durationMs = now() - startedAt;

  return {
    wordCount: EXTRACTION_ARTICLE.split(/\s+/u).filter(Boolean).length,
    durationMs,
    isValid: outcome.ok,
    correctCount: outcome.ok ? countCorrect(outcome.value.products) : 0,
    expectedCount: EXTRACTION_ARTICLE_TABLE.length * NUMERIC_FIELDS.length,
    ...(outcome.ok ? {} : { reason: outcome.reason }),
    meetsBudget: outcome.ok && durationMs <= MAXIMUM_EXTRACTION_MS,
  };
};
