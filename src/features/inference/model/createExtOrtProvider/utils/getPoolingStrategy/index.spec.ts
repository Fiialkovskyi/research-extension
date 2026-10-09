import { describe, expect, it } from "vitest";

import { getPoolingStrategy } from ".";
import type { EmbeddingContract } from "@/shared/modelManifest";

const contract = (pooling: EmbeddingContract["pooling"]): EmbeddingContract => ({
  family: "embedding",
  dimensions: 384,
  maxInputTokens: 512,
  pooling,
  normalize: true,
  similarity: "cosine",
  prefixes: { query: "", document: "" },
});

describe("getPoolingStrategy", () => {
  it("passes through mean pooling, which the default profile declares", () => {
    expect(getPoolingStrategy(contract("mean"))).toBe("mean");
  });

  it("passes through cls pooling, which the second profile declares", () => {
    expect(getPoolingStrategy(contract("cls"))).toBe("cls");
  });

  it("refuses last-token pooling rather than silently substituting another", () => {
    expect(() => getPoolingStrategy(contract("last_token"))).toThrow(/cannot apply/);
  });

  it("explains why a substitution would be worse than a refusal", () => {
    expect(() => getPoolingStrategy(contract("last_token"))).toThrow(/plausible but meaningless/);
  });
});
