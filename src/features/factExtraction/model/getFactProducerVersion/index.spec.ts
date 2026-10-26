import { describe, expect, it } from "vitest";

import { getFactProducerVersion } from ".";
import { CHUNKER_VERSION } from "@/features/snapshotEmbeddings";

describe("getFactProducerVersion", () => {
  it("names the prompt version, the model and the chunker", () => {
    expect(getFactProducerVersion("ollama:qwen3:4b@abc")).toBe(
      `factExtraction@3|ollama:qwen3:4b@abc|${CHUNKER_VERSION}`,
    );
  });

  it("differs between models", () => {
    expect(getFactProducerVersion("a")).not.toBe(getFactProducerVersion("b"));
  });
});
