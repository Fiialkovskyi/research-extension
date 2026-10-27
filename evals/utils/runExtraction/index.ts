import {
  buildFactExtractionMessages,
  buildProductFacts,
  FACT_ANSWER_MAX_TOKENS,
  FACT_CONTEXT_TOKENS,
  FACT_EXTRACTION_PROMPT,
  type ExtractedFact,
  isImplausibleSubject,
  isQuoteGrounded,
  PRODUCT_ENTITY_TYPE,
  readFactAnswer,
  repairSubject,
  tidyFacts,
  UNKNOWN_ENTITY_TYPE,
} from "@/features/factExtraction";
import type { GenerateRequest, GenerationStream } from "@/features/inference";
import { chunkText } from "@/features/snapshotEmbeddings";
import { normalizeEntityName } from "@/shared/normalizeEntityName";

import type { ReadPage } from "../readPageForEvals";

/** A fact kept from a page, with the type its subject was given and where it came from. */
export interface PageFact extends ExtractedFact {
  entityType: string;
  /** From the page's own product data, not read by the model. */
  isPageData: boolean;
}

export interface ExtractionResult {
  /** The facts kept: the page's own data first, then what the model read and the page confirms. */
  facts: PageFact[];
  /** Facts the model answered with, whatever became of them. */
  answered: number;
  /** Of those, the ones whose quote is not in the passage. */
  ungrounded: number;
  /** Of those grounded, the ones whose subject cannot be a thing the page is about. */
  junk: number;
  requestCount: number;
  /** Requests whose answer was not JSON in the schema: the extension would drop the whole chunk. */
  invalidChunks: number;
  /** Requests the model ran out of tokens in, which is why most answers cannot be read. */
  truncatedChunks: number;
  durationMs: number;
}

/**
 * Extracts a page's facts as `runFactExtractionJob` does, without the database:
 * the same chunker, the same request with what the page says it is, the same
 * check of each answer against its passage and of each subject, and the facts
 * of the page's own product data first. Counts what the check dropped, which is
 * what the extension would hide from the user.
 */
export const runExtraction = async (
  { text, metadata }: ReadPage,
  generate: (request: GenerateRequest) => GenerationStream,
  now: () => number = Date.now,
): Promise<ExtractionResult> => {
  const startedAt = now();
  const passages =
    text === undefined ? [] : chunkText(text).map((chunk) => text.slice(chunk.start, chunk.end));
  const context = {
    title: metadata?.title,
    siteName: metadata?.siteName,
    productName: metadata?.product?.name,
  };
  const facts: PageFact[] = buildProductFacts(metadata?.product).map((fact) => ({
    ...fact,
    entityType: PRODUCT_ENTITY_TYPE,
    isPageData: true,
  }));
  let answered = 0;
  let ungrounded = 0;
  let junk = 0;
  let invalidChunks = 0;
  let truncatedChunks = 0;

  // One request at a time, as the job runs them: a local server does not go faster in parallel.
  for (const passage of passages) {
    const result = await generate({
      messages: buildFactExtractionMessages(passage, context),
      maxTokens: FACT_ANSWER_MAX_TOKENS,
      temperature: 0,
      responseSchema: FACT_EXTRACTION_PROMPT.jsonSchema,
      contextTokens: FACT_CONTEXT_TOKENS,
    }).final();
    const answer = readFactAnswer(result.text);

    truncatedChunks += result.stoppedBecause === "token-limit" ? 1 : 0;
    invalidChunks += answer.isValid ? 0 : 1;

    if (answer.isValid) {
      const types = new Map(
        answer.answer.entities.map(({ name, entity_type: type }) => [
          normalizeEntityName(repairSubject(name, context.productName)),
          type,
        ]),
      );

      const grounded = answer.answer.facts.filter((fact) => isQuoteGrounded(fact.quote, passage));
      const plausible = grounded.filter((fact) => !isImplausibleSubject(fact));
      const tidied = tidyFacts(plausible, context.productName);

      answered += answer.answer.facts.length;
      ungrounded += answer.answer.facts.length - grounded.length;
      junk += grounded.length - tidied.facts.length;

      for (const fact of tidied.facts) {
        facts.push({
          ...fact,
          entityType: types.get(normalizeEntityName(fact.subject)) ?? UNKNOWN_ENTITY_TYPE,
          isPageData: false,
        });
      }
    }
  }

  return {
    facts,
    answered,
    ungrounded,
    junk,
    requestCount: passages.length,
    invalidChunks,
    truncatedChunks,
    durationMs: now() - startedAt,
  };
};
