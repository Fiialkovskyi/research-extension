import type { EmbeddingContract } from "@/shared/modelManifest";

import { SPECIAL_TOKENS, TOKENS_PER_WORD } from "../../constants";

const toWords = (text: string): string[] => text.split(/\s+/u).filter(Boolean);

/** Tokens a run of words is estimated to take, with the special tokens around it. */
const estimateTokens = (wordCount: number): number =>
  Math.ceil(wordCount * TOKENS_PER_WORD) + SPECIAL_TOKENS;

/**
 * Fits a chunk to a model's input limit: whole when its estimated length, the
 * document prefix included, fits; otherwise the fewest consecutive runs of
 * words that each fit. Every word lands in exactly one part.
 *
 * Estimated, because the background has no tokenizer: the estimate errs high,
 * so a model truncating a part loses at most its last few tokens.
 *
 * @returns The parts' texts, without the prefix the model adds.
 */
export const splitChunkForModel = (text: string, contract: EmbeddingContract): string[] => {
  const words = toWords(text);
  const prefixWords = toWords(contract.prefixes.document).length;
  const budget = Math.max(
    1,
    Math.floor((contract.maxInputTokens - SPECIAL_TOKENS) / TOKENS_PER_WORD) - prefixWords,
  );

  if (estimateTokens(words.length + prefixWords) <= contract.maxInputTokens) {
    return words.length === 0 ? [] : [text];
  }

  const parts: string[] = [];

  for (let start = 0; start < words.length; start += budget) {
    parts.push(words.slice(start, start + budget).join(" "));
  }

  return parts;
};
