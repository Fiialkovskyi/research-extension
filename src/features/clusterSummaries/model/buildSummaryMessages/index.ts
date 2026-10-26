import type { ChatMessage } from "@/features/inference";

import { CLUSTER_SUMMARY_PROMPT, FACTS_CLOSE, FACTS_OPEN } from "../../constants";
import type { SummaryFact } from "../../types";

/** Keeps a fact's text from closing the block or breaking its line. */
const escapeField = (text: string): string =>
  text
    .replaceAll(FACTS_CLOSE, "</facts_>")
    .replaceAll(/[\r\n|]+/gu, " ")
    .trim();

/**
 * Builds the request for one summary (REQ-SYN-011) — or another prompt over the
 * same facts, given its instructions: the prompt as the system message, and
 * the facts as data — one labelled line each, `F1` upwards, between the facts
 * delimiters — naming the product the fact is about, not its raw subject.
 *
 * @returns The messages, and the fact id each label stands for.
 */
export const buildSummaryMessages = (
  facts: readonly SummaryFact[],
  instructions: string = CLUSTER_SUMMARY_PROMPT.instructions,
): { messages: ChatMessage[]; labels: Map<string, string> } => {
  const labels = new Map(facts.map(({ id }, index) => [`F${index + 1}`, id]));
  const lines = facts.map(
    ({ entityName, attribute, value, unit, quote }, index) =>
      `F${index + 1} | ${escapeField(entityName)} | ${escapeField(attribute)} | ${escapeField(
        unit === undefined ? value : `${value} ${unit}`,
      )} | "${escapeField(quote)}"`,
  );

  return {
    messages: [
      { role: "system", content: instructions },
      { role: "user", content: `${FACTS_OPEN}\n${lines.join("\n")}\n${FACTS_CLOSE}` },
    ],
    labels,
  };
};
