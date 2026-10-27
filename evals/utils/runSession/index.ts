import {
  CLUSTER_SUMMARY_PROMPT,
  MAXIMUM_SUMMARY_FACTS,
  readProductCards,
  readSummaryAnswer,
  SUMMARY_ANSWER_MAX_TOKENS,
  SUMMARY_CONTEXT_TOKENS,
  selectSummaryFacts,
  buildSummaryMessages,
  type ProductCard,
  type SummaryFact,
} from "@/features/clusterSummaries";
import type { GenerateRequest, GenerationStream } from "@/features/inference";
import { normalizeEntityName } from "@/shared/normalizeEntityName";
import { type EmbedConcepts, resolveConceptKeys } from "@/shared/resolveConceptKeys";

import type { PageFact } from "../runExtraction";

/** What the facts of every page, taken as one session, make of the table, the cards and the summary. */
export interface SessionResult {
  /** Each concept the run produced, to the column it was given. */
  keys: Map<string, string>;
  cards: ProductCard[];
  /** The summary's statements; empty when the model's answer could not be read. */
  statements: string[];
  requestCount: number;
  durationMs: number;
}

/**
 * Builds a session from its pages' facts as the extension builds one, without the
 * database: concepts to columns (`resolveConceptKeys`, with embeddings when `embed`
 * is given), product cards from the facts, and one summary over the facts chosen
 * for it. Facts about the same thing are grouped by the normalised name of their
 * subject; the extension's entity resolution would also join names that only
 * mean the same, so the cards here may list a product twice.
 */
export const runSession = async (
  pages: readonly { id: string; facts: readonly PageFact[] }[],
  generate: (request: GenerateRequest) => GenerationStream,
  embed?: EmbedConcepts,
  now: () => number = Date.now,
): Promise<SessionResult> => {
  const startedAt = now();
  const all = pages.flatMap(({ id, facts }) => facts.map((fact, index) => ({ id, index, fact })));
  const keys = await resolveConceptKeys(
    all.map(({ fact }) => fact.concept),
    embed,
  );
  const facts = all.map(({ id, index, fact }): SummaryFact => ({
    id: `${id}:${index}`,
    nodeId: id,
    groupKey: normalizeEntityName(fact.subject),
    entityName: fact.subject,
    entityType: fact.entityType,
    subject: fact.subject,
    attribute: fact.attribute,
    attributeKey: keys.get(fact.concept) ?? normalizeEntityName(fact.concept),
    value: fact.value,
    ...(fact.unit === undefined ? {} : { unit: fact.unit }),
    quote: fact.quote,
    isPageData: fact.isPageData,
  }));
  const { cards } = readProductCards(facts, ({ id, quote }) => ({
    factId: id,
    pageTitle: "",
    url: "",
    quote,
  }));
  let statements: string[] = [];
  let requestCount = 0;

  if (facts.length > 0) {
    const { selected } = selectSummaryFacts(facts, MAXIMUM_SUMMARY_FACTS);
    const { messages, labels } = buildSummaryMessages(selected);
    const result = await generate({
      messages,
      maxTokens: SUMMARY_ANSWER_MAX_TOKENS,
      temperature: 0,
      responseSchema: CLUSTER_SUMMARY_PROMPT.jsonSchema,
      contextTokens: SUMMARY_CONTEXT_TOKENS,
    }).final();

    requestCount = 1;

    try {
      statements = readSummaryAnswer(result.text, labels).map(({ text }) => text);
    } catch {
      // An answer the extension would have failed the job over has no statements to count.
    }
  }

  return { keys, cards, statements, requestCount, durationMs: now() - startedAt };
};
