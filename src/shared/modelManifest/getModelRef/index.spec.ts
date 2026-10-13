import { describe, expect, it } from "vitest";

import { getModelRef } from ".";

const reference = {
  hub: "huggingface",
  repository: "Xenova/all-MiniLM-L6-v2",
  revision: "751bff37182d3f1213fa05d7196b954e230abad9",
} as const;

describe("getModelRef", () => {
  it("joins repository and revision, so the key names exactly what is installed", () => {
    expect(getModelRef(reference)).toBe(
      "Xenova/all-MiniLM-L6-v2@751bff37182d3f1213fa05d7196b954e230abad9",
    );
  });

  it("distinguishes two revisions of one repository, so neither overwrites the other", () => {
    const other = { ...reference, revision: "0".repeat(40) };

    expect(getModelRef(reference)).not.toBe(getModelRef(other));
  });

  it("is stable across calls", () => {
    expect(getModelRef(reference)).toBe(getModelRef({ ...reference }));
  });

  it("names a local server's model by its hub, name and digest", () => {
    expect(
      getModelRef({
        hub: "ollama",
        repository: "nomic-embed-text:latest",
        revision: "b".repeat(64),
      }),
    ).toBe(`ollama:nomic-embed-text:latest@${"b".repeat(64)}`);
  });
});
