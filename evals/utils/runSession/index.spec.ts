import type { GenerateRequest, GenerationStream } from "@/features/inference";
import { describe, expect, it } from "vitest";

import type { PageFact } from "../runExtraction";
import { runSession } from ".";

const fact = (subject: string, concept: string, value: string): PageFact => ({
  subject,
  attribute: concept,
  concept,
  value,
  quote: `${concept} ${value}`,
  entityType: "product",
  isPageData: false,
});

const pages = [
  {
    id: "a",
    facts: [
      fact("Pixel 10a", "battery capacity", "5100"),
      fact("Pixel 10a", "weight", "184"),
      fact("Pixel 10a", "screen size", "6.3"),
    ],
  },
  {
    id: "b",
    facts: [
      fact("Pixel 10 Pro", "battery size", "4870"),
      fact("Pixel 10 Pro", "mass", "207"),
      fact("Pixel 10 Pro", "screen size", "6.3"),
    ],
  },
];

const answering =
  (text: string, seen: GenerateRequest[] = []) =>
  (request: GenerateRequest): GenerationStream => {
    seen.push(request);

    return {
      async *[Symbol.asyncIterator]() {},
      final: () =>
        Promise.resolve({
          text,
          device: "local-server" as const,
          stoppedBecause: "model" as const,
        }),
    };
  };

describe("runSession", () => {
  it("gives equal concepts one column, and makes a card for each product", async () => {
    const result = await runSession(
      pages,
      answering(
        JSON.stringify({ statements: [{ text: "Pixel 10a weighs 184 g.", facts: ["F2"] }] }),
      ),
    );

    expect(result.keys.get("screen size")).toBe("screen size");
    expect(result.cards.map(({ name }) => name).toSorted()).toEqual(["Pixel 10 Pro", "Pixel 10a"]);
  });

  it("merges concepts the embedding finds alike", async () => {
    const vectors = new Map([
      ["battery capacity", [1, 0]],
      ["battery size", [1, 0.01]],
    ]);
    const result = await runSession(pages, answering(JSON.stringify({ statements: [] })), (texts) =>
      Promise.resolve(texts.map((text) => Float32Array.from(vectors.get(text) ?? [0, 1]))),
    );

    expect(result.keys.get("battery size")).toBe(result.keys.get("battery capacity"));
  });

  it("returns the statements the model's answer cites facts for", async () => {
    const seen: GenerateRequest[] = [];
    const result = await runSession(
      pages,
      answering(
        JSON.stringify({ statements: [{ text: "Both have a 6.3 inch screen.", facts: ["F1"] }] }),
        seen,
      ),
    );

    expect(result.statements).toEqual(["Both have a 6.3 inch screen."]);
    expect(result.requestCount).toBe(1);
    expect(seen[0]?.messages[1]?.content).toContain("F1 |");
  });

  it("has no statements when the answer cannot be read, and asks nothing without facts", async () => {
    expect((await runSession(pages, answering("not json"))).statements).toEqual([]);
    expect(await runSession([], answering("x"))).toMatchObject({ requestCount: 0, cards: [] });
  });
});
