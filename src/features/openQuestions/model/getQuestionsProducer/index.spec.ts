import { describe, expect, it } from "vitest";

import { getQuestionsProducer } from ".";

describe("getQuestionsProducer", () => {
  it("names the prompt version and the model", () => {
    expect(getQuestionsProducer("ollama:qwen3:4b@abc")).toBe("openQuestions@1|ollama:qwen3:4b@abc");
  });
});
