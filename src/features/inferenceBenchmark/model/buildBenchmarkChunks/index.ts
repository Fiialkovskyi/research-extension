import { BENCHMARK_CHUNK_WORDS, BENCHMARK_VOCABULARY } from "../../constants";

/**
 * A small deterministic generator.
 *
 * Seeded on purpose: a benchmark whose input changes between runs cannot be
 * used to compare two compute paths, because a difference in the number would
 * no longer be attributable to the thing under test.
 */
const createSequence = (seed: number): (() => number) => {
  let state = seed >>> 0 || 1;

  return () => {
    // xorshift32: trivial, fast, and good enough to vary token sequences.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;

    return state;
  };
};

/**
 * Builds the benchmark's input: distinct chunks of a realistic length.
 *
 * Distinct rather than one chunk repeated, because a tokenizer or a session
 * cache could make repeated text far cheaper than real text and quietly turn
 * the benchmark into a measurement of caching.
 *
 * @param count how many chunks to produce.
 * @param seed fixes the text, so two runs measure the same work.
 */
export const buildBenchmarkChunks = (count: number, seed = 1): string[] => {
  const next = createSequence(seed);

  return Array.from({ length: count }, () =>
    Array.from(
      { length: BENCHMARK_CHUNK_WORDS },
      () => BENCHMARK_VOCABULARY[next() % BENCHMARK_VOCABULARY.length] ?? "word",
    ).join(" "),
  );
};
