import { describe, expect, it } from "vitest";

import { buildEmbeddingSpace } from ".";

const reference = {
  hub: "huggingface" as const,
  repository: "Xenova/all-MiniLM-L6-v2",
  revision: "a".repeat(40),
};
const contract = {
  family: "embedding" as const,
  dimensions: 384,
  maxInputTokens: 256,
  pooling: "mean" as const,
  normalize: true,
  similarity: "cosine" as const,
  prefixes: { query: "", document: "" },
};

const build = (overrides: Partial<Parameters<typeof buildEmbeddingSpace>[0]> = {}) =>
  buildEmbeddingSpace({
    reference,
    contract,
    extractorVersion: "readability@0.6.0/1",
    now: 5,
    ...overrides,
  });

describe("buildEmbeddingSpace", () => {
  it("gives the same id for the same choices", async () => {
    expect((await build()).id).toBe((await build({ now: 9 })).id);
    expect((await build()).id).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gives a new id for a new commit, chunker input or extractor", async () => {
    const base = (await build()).id;

    expect((await build({ reference: { ...reference, revision: "b".repeat(40) } })).id).not.toBe(
      base,
    );
    expect((await build({ extractorVersion: "readability@0.7.0/1" })).id).not.toBe(base);
    expect((await build({ contract: { ...contract, normalize: false } })).id).not.toBe(base);
    expect((await build({ quantization: "q8" })).id).not.toBe(base);
  });

  it("records every choice beside the id", async () => {
    expect(await build()).toMatchObject({
      model: { repository: "Xenova/all-MiniLM-L6-v2", revision: "a".repeat(40) },
      dims: 384,
      pooling: "mean",
      normalize: true,
      similarity: "cosine",
      prefixes: { query: "", document: "" },
      chunkerVersion: "chunker@1",
      extractorVersion: "readability@0.6.0/1",
      quantization: null,
      createdAt: 5,
    });
  });
});
