import { describe, expect, it } from "vitest";

import { matchesOllamaName } from ".";

describe("matchesOllamaName", () => {
  it("lets a bare name stand for any of its tags", () => {
    expect(matchesOllamaName("nomic-embed-text", "nomic-embed-text:latest")).toBe(true);
    expect(matchesOllamaName("nomic-embed-text", "nomic-embed-text:v1.5")).toBe(true);
    expect(matchesOllamaName("nomic-embed-text", "nomic-embed-text")).toBe(true);
  });

  it("holds a tagged name to that tag", () => {
    expect(matchesOllamaName("qwen3:4b", "qwen3:4b")).toBe(true);
    expect(matchesOllamaName("qwen3:4b", "qwen3:0.6b")).toBe(false);
    expect(matchesOllamaName("qwen3:4b", "qwen3")).toBe(false);
  });

  it("does not match a different model that shares a prefix", () => {
    expect(matchesOllamaName("all-minilm", "all-minilm-extra:latest")).toBe(false);
  });
});
