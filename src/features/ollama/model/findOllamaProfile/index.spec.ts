import { describe, expect, it } from "vitest";

import { findOllamaProfile } from ".";

describe("findOllamaProfile", () => {
  it("finds a profile by name, with or without a tag", () => {
    expect(findOllamaProfile("nomic-embed-text:v1.5")?.name).toBe("nomic-embed-text");
    expect(findOllamaProfile("nomic-embed-text")).toMatchObject({
      prefixes: { document: "search_document: " },
    });
  });

  it("finds a tagged profile only under its own tag", () => {
    expect(findOllamaProfile("qwen3:4b")?.family).toBe("text-generation");
    expect(findOllamaProfile("qwen3:0.6b")).toBeUndefined();
  });

  it("finds none for a model the add-on has no profile for", () => {
    expect(findOllamaProfile("unknown")).toBeUndefined();
  });
});
