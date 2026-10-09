import { describe, expect, it } from "vitest";

import { buildBenchmarkChunks } from ".";
import { BENCHMARK_CHUNK_WORDS, BENCHMARK_VOCABULARY } from "../../constants";

describe("buildBenchmarkChunks", () => {
  it("produces the number of chunks asked for", () => {
    expect(buildBenchmarkChunks(40)).toHaveLength(40);
  });

  it("gives every chunk the length the synthesis pipeline targets", () => {
    for (const chunk of buildBenchmarkChunks(5)) {
      expect(chunk.split(" ")).toHaveLength(BENCHMARK_CHUNK_WORDS);
    }
  });

  it("produces distinct chunks, so the benchmark does not measure caching", () => {
    const chunks = buildBenchmarkChunks(40);

    expect(new Set(chunks).size).toBe(chunks.length);
  });

  it("is deterministic, so two runs measure the same work", () => {
    expect(buildBenchmarkChunks(10)).toEqual(buildBenchmarkChunks(10));
  });

  it("produces different text for a different seed", () => {
    expect(buildBenchmarkChunks(5, 1)).not.toEqual(buildBenchmarkChunks(5, 2));
  });

  it("draws only on the bundled vocabulary, so nothing is fetched", () => {
    const allowed = new Set(BENCHMARK_VOCABULARY);

    for (const word of buildBenchmarkChunks(3).flatMap((chunk) => chunk.split(" "))) {
      expect(allowed.has(word)).toBe(true);
    }
  });

  it("uses much of the vocabulary rather than cycling a few words", () => {
    const used = new Set(buildBenchmarkChunks(10).flatMap((chunk) => chunk.split(" ")));

    expect(used.size).toBeGreaterThan(BENCHMARK_VOCABULARY.length / 2);
  });

  it("produces nothing for a run of no chunks", () => {
    expect(buildBenchmarkChunks(0)).toEqual([]);
  });
});
