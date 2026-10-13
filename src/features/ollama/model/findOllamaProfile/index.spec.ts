import { describe, expect, it } from "vitest";

import { findOllamaProfile } from ".";

describe("findOllamaProfile", () => {
  it("finds a profile by name, with or without a tag", () => {
    expect(findOllamaProfile("nomic-embed-text:v1.5")?.name).toBe("nomic-embed-text");
    expect(findOllamaProfile("nomic-embed-text")?.prefixes.document).toBe("search_document: ");
  });

  it("finds none for a model the add-on has no profile for", () => {
    expect(findOllamaProfile("unknown")).toBeUndefined();
  });
});
