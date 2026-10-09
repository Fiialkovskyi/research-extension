import { describe, expect, it } from "vitest";

import { getPrefixedTexts } from ".";
import { BGE_SMALL_EN_V1_5, MINILM_L6_V2 } from "@/shared/config/modelProfiles";
import type { EmbeddingContract } from "@/shared/modelManifest";

const contractWith = (prefixes: EmbeddingContract["prefixes"]): EmbeddingContract => ({
  family: "embedding",
  dimensions: 384,
  maxInputTokens: 512,
  pooling: "mean",
  normalize: true,
  similarity: "cosine",
  prefixes,
});

/** The real prefixes of the two bundled profiles. */
const symmetric = contractWith(
  MINILM_L6_V2.contract.family === "embedding"
    ? MINILM_L6_V2.contract.prefixes
    : { query: "", document: "" },
);
const asymmetric = contractWith(
  BGE_SMALL_EN_V1_5.contract.family === "embedding"
    ? BGE_SMALL_EN_V1_5.contract.prefixes
    : { query: "", document: "" },
);

describe("getPrefixedTexts", () => {
  it("leaves text untouched for a model that declares no prefixes", () => {
    expect(getPrefixedTexts(symmetric, "query", ["electric bikes"])).toEqual(["electric bikes"]);
  });

  it("applies the query instruction of a model that declares one", () => {
    const [prefixed] = getPrefixedTexts(asymmetric, "query", ["electric bikes"]);

    expect(prefixed?.startsWith("Represent this sentence")).toBe(true);
    expect(prefixed?.endsWith("electric bikes")).toBe(true);
  });

  it("leaves the document side of an asymmetric model unprefixed", () => {
    expect(getPrefixedTexts(asymmetric, "document", ["a review"])).toEqual(["a review"]);
  });

  it("produces different text for the two roles, which is the whole point", () => {
    expect(getPrefixedTexts(asymmetric, "query", ["x"])).not.toEqual(
      getPrefixedTexts(asymmetric, "document", ["x"]),
    );
  });

  it("produces the same text for both roles when no prefix is declared", () => {
    expect(getPrefixedTexts(symmetric, "query", ["x"])).toEqual(
      getPrefixedTexts(symmetric, "document", ["x"]),
    );
  });

  it("prefixes every text in a batch, not just the first", () => {
    const prefixed = getPrefixedTexts(asymmetric, "query", ["a", "b", "c"]);

    expect(prefixed.every((text) => text.startsWith("Represent this sentence"))).toBe(true);
  });

  it("keeps the batch order, so vectors line up with their inputs", () => {
    expect(getPrefixedTexts(asymmetric, "document", ["first", "second"])).toEqual([
      "first",
      "second",
    ]);
  });

  it("returns a new array rather than mutating the caller's", () => {
    const texts = ["x"];

    expect(getPrefixedTexts(symmetric, "query", texts)).not.toBe(texts);
  });

  it("handles an empty batch", () => {
    expect(getPrefixedTexts(asymmetric, "query", [])).toEqual([]);
  });

  it("applies the prefix to empty text too, rather than skipping it", () => {
    // A blank input is still an input; silently dropping the instruction would
    // make one vector in a batch mean something different from the rest.
    expect(getPrefixedTexts(asymmetric, "query", [""])).toEqual([asymmetric.prefixes.query]);
  });
});
