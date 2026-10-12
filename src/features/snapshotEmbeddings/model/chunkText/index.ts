import { CHUNK_TARGET_WORDS } from "../../constants";

/** A chunk of a text, by its range: UTF-16 offsets, end exclusive. */
export interface TextChunk {
  index: number;
  start: number;
  end: number;
}

const countWords = (text: string): number => text.split(/\s+/u).filter(Boolean).length;

/**
 * Cuts a text into chunks of whole sentences, about the target number of words
 * each (`chunker@1`). Each chunk after the first begins with the last sentence
 * of the one before, so a thought split across the boundary is whole in one of
 * them. A sentence longer than a chunk is a chunk of its own.
 *
 * Model-independent: fitting a chunk to a model's input limit happens when it
 * is embedded.
 */
export const chunkText = (text: string): TextChunk[] => {
  const sentences = [...new Intl.Segmenter(undefined, { granularity: "sentence" }).segment(text)]
    .map(({ segment, index }) => ({
      start: index,
      end: index + segment.length,
      words: countWords(segment),
    }))
    .filter(({ words }) => words > 0);
  const chunks: TextChunk[] = [];
  let first = 0;

  while (first < sentences.length) {
    let last = first;
    let words = sentences[first]?.words ?? 0;

    while (last + 1 < sentences.length && words < CHUNK_TARGET_WORDS) {
      last += 1;
      words += sentences[last]?.words ?? 0;
    }

    chunks.push({
      index: chunks.length,
      start: sentences[first]?.start ?? 0,
      end: sentences[last]?.end ?? 0,
    });

    if (last + 1 >= sentences.length) {
      break;
    }

    // Overlap by one sentence, unless the chunk was a single sentence: then
    // starting at it again would never move on.
    first = last > first ? last : last + 1;
  }

  return chunks;
};
