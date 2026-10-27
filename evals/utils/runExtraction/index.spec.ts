import type { GenerationStream } from "@/features/inference";
import { describe, expect, it } from "vitest";

import { runExtraction } from ".";

const text =
  "The Pixel 10a weighs 184 g. Its battery holds 5100 mAh. The phone has a 6.3 inch screen.";

/** A model that answers every request with the given facts. */
const answerWith =
  (facts: object[], seen: unknown[] = []) =>
  (request: unknown): GenerationStream => {
    seen.push(request);

    return {
      async *[Symbol.asyncIterator]() {},
      final: () =>
        Promise.resolve({
          text: JSON.stringify({
            entities: [{ name: "Pixel 10a", entity_type: "product" }],
            facts,
          }),
          device: "local-server" as const,
          stoppedBecause: "model" as const,
        }),
    };
  };

const weight = {
  subject: "Pixel 10a",
  attribute: "Weight",
  concept: "weight",
  value: "184",
  unit: "g",
  quote: "weighs 184 g",
};

describe("runExtraction", () => {
  it("keeps a fact whose quote is in the passage, with its subject's type", async () => {
    const result = await runExtraction({ text, metadata: undefined }, answerWith([weight]));

    expect(result.facts).toEqual([{ ...weight, entityType: "product", isPageData: false }]);
    expect(result).toMatchObject({ answered: 1, ungrounded: 0, junk: 0, requestCount: 1 });
  });

  it("counts a quote the page does not hold, and a subject that is a number", async () => {
    const invented = { ...weight, quote: "weighs 300 g" };
    const junk = { ...weight, subject: "184 g", quote: "weighs 184 g" };
    const result = await runExtraction(
      { text, metadata: undefined },
      answerWith([weight, invented, junk]),
    );

    expect(result.facts).toHaveLength(1);
    expect(result).toMatchObject({ answered: 3, ungrounded: 1, junk: 1 });
  });

  it("puts the page's own product data first, and says what the page is in the request", async () => {
    const seen: { messages: { content: string }[] }[] = [];
    const result = await runExtraction(
      {
        text,
        metadata: { title: "Pixel 10a", product: { name: "Pixel 10a", brand: "Google" } },
      },
      answerWith([weight], seen),
    );

    expect(result.facts[0]).toMatchObject({
      attribute: "brand",
      value: "Google",
      isPageData: true,
    });
    expect(seen[0]?.messages[1]?.content).toContain("Pixel 10a");
  });

  it("asks nothing of a page with no text", async () => {
    const seen: unknown[] = [];
    const result = await runExtraction(
      { text: undefined, metadata: undefined },
      answerWith([weight], seen),
    );

    expect(seen).toEqual([]);
    expect(result).toMatchObject({ facts: [], answered: 0, requestCount: 0 });
  });

  it("treats an answer that is not in the schema as having no facts", async () => {
    const result = await runExtraction({ text, metadata: undefined }, () => ({
      async *[Symbol.asyncIterator]() {},
      final: () =>
        Promise.resolve({
          text: "not json",
          device: "local-server" as const,
          stoppedBecause: "model" as const,
        }),
    }));

    expect(result).toMatchObject({ facts: [], answered: 0, requestCount: 1, invalidChunks: 1 });
  });

  it("counts an answer the model was cut off in", async () => {
    const result = await runExtraction({ text, metadata: undefined }, () => ({
      async *[Symbol.asyncIterator]() {},
      final: () =>
        Promise.resolve({
          text: '{"entities": [',
          device: "local-server" as const,
          stoppedBecause: "token-limit" as const,
        }),
    }));

    expect(result).toMatchObject({ invalidChunks: 1, truncatedChunks: 1 });
  });
});
