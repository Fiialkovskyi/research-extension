import { describe, expect, it } from "vitest";

import { splitChunkForModel } from ".";

const contract = (maxInputTokens: number, document = "") => ({
  family: "embedding" as const,
  dimensions: 384,
  maxInputTokens,
  pooling: "mean" as const,
  normalize: true,
  similarity: "cosine" as const,
  prefixes: { query: "", document },
});

const words = (count: number) => Array.from({ length: count }, (_, index) => `w${index}`).join(" ");
const estimate = (text: string) => Math.ceil(text.split(" ").length * 1.4) + 2;

describe("splitChunkForModel", () => {
  it("keeps a chunk that fits whole, as written", () => {
    const text = `  ${words(50)}\n`;

    expect(splitChunkForModel(text, contract(256))).toEqual([text]);
  });

  it("splits a chunk that does not fit into parts that each fit and cover every word once", () => {
    const text = words(220);
    const parts = splitChunkForModel(text, contract(128));

    expect(parts.length).toBeGreaterThanOrEqual(2);
    expect(parts.every((part) => estimate(part) <= 128)).toBe(true);
    expect(parts.join(" ")).toBe(text);
  });

  it("counts the document prefix against the limit", () => {
    const text = words(88);

    expect(splitChunkForModel(text, contract(128))).toHaveLength(1);
    expect(splitChunkForModel(text, contract(128, "passage: please read"))).toHaveLength(2);
  });

  it("gives nothing for an empty chunk", () => {
    expect(splitChunkForModel("   ", contract(128))).toEqual([]);
  });
});
