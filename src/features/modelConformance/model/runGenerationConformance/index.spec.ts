import { describe, expect, it } from "vitest";

import { runGenerationConformance } from ".";
import type { GenerateRequest, GenerateResult, GenerationStream } from "@/features/inference";
import { EXTRACTION_PROBES } from "../../constants";

interface FakeModelOptions {
  /** How the model answers each passage; by default, correctly. */
  extract?: (probe: (typeof EXTRACTION_PROBES)[number]) => string;
  honoursLimit?: boolean;
  honoursCancel?: boolean;
  /** Throws on every request, as a server that is away does. */
  isAway?: boolean;
}

const answer = (text: string, stoppedBecause: GenerateResult["stoppedBecause"]) =>
  ({ text, device: "local-server", stoppedBecause }) as const;

/** A stand-in model: extracts from the bundled passages, counts, and stops as told. */
const createFakeModel = ({
  extract = ({ expected }) => JSON.stringify(expected),
  honoursLimit = true,
  honoursCancel = true,
  isAway = false,
}: FakeModelOptions = {}) => {
  const requests: GenerateRequest[] = [];
  const generate = (request: GenerateRequest): GenerationStream => {
    requests.push(request);

    if (isAway) {
      throw new Error("Ollama is not running at http://127.0.0.1:11434.");
    }

    const passage = request.messages.at(-1)?.content ?? "";
    const probe = EXTRACTION_PROBES.find((candidate) => candidate.passage === passage);

    if (probe !== undefined) {
      const text = extract(probe);

      return {
        async *[Symbol.asyncIterator]() {
          yield { delta: text };
        },
        final: () => Promise.resolve(answer(text, "model")),
      };
    }

    // The long answer: endless unless limited or cancelled.
    return {
      async *[Symbol.asyncIterator]() {
        yield { delta: "one, " };
        yield { delta: "two, " };
      },
      final: () =>
        Promise.resolve(
          request.signal?.aborted === true && honoursCancel
            ? answer("one, ", "cancelled")
            : answer("one, two, ", honoursLimit ? "token-limit" : "model"),
        ),
    };
  };

  return { generate, requests };
};

describe("runGenerationConformance", () => {
  it("passes a model that stops when told and extracts every product", async () => {
    const outcome = await runGenerationConformance(createFakeModel().generate);

    expect(outcome.passed).toBe(true);
    expect(outcome.probes.map(({ name }) => name)).toEqual([
      "stops when cancelled",
      "stops at its token limit",
      "extracts products into a schema",
    ]);
    expect(outcome.probes[2]?.detail).toBe("5 of 5 extracted correctly, 4 required");
  });

  it("asks for extraction deterministically, in a schema, within a limit", async () => {
    const model = createFakeModel();

    await runGenerationConformance(model.generate);

    const extraction = model.requests.find(({ responseSchema }) => responseSchema !== undefined);

    expect(extraction).toMatchObject({ temperature: 0, maxTokens: 256 });
    expect(extraction?.responseSchema).toMatchObject({
      required: ["name", "priceUsd", "weightKg"],
    });
  });

  it("tolerates one wrong extraction of five", async () => {
    const outcome = await runGenerationConformance(
      createFakeModel({
        extract: ({ expected }) =>
          JSON.stringify(expected.name === "Ridge 30" ? { ...expected, weightKg: 850 } : expected),
      }).generate,
    );

    expect(outcome.passed).toBe(true);
    expect(outcome.probes[2]?.detail).toContain("Ridge 30: weight 850 kg, expected 0.85");
  });

  it("refuses a model that gets two wrong, naming them", async () => {
    const outcome = await runGenerationConformance(
      createFakeModel({
        extract: ({ expected }) =>
          expected.name === "Volta E5"
            ? "It costs $2,399."
            : JSON.stringify(
                expected.name === "Northwind 2" ? { ...expected, priceUsd: 45 } : expected,
              ),
      }).generate,
    );

    expect(outcome).toMatchObject({ passed: false });
    expect(outcome.passed ? "" : outcome.reason).toMatch(
      /^extracts products into a schema: 3 of 5 extracted correctly, 4 required \(Volta E5: The answer was not JSON\.; Northwind 2: price 45, expected 349\)$/u,
    );
  });

  it("refuses a model that ignores its token limit, naming that probe", async () => {
    const outcome = await runGenerationConformance(
      createFakeModel({ honoursLimit: false }).generate,
    );

    expect(outcome.passed ? "" : outcome.reason).toMatch(/^stops at its token limit:/u);
  });

  it("refuses a model that keeps going when cancelled", async () => {
    const outcome = await runGenerationConformance(
      createFakeModel({ honoursCancel: false }).generate,
    );

    expect(outcome.probes[0]).toMatchObject({ name: "stops when cancelled", passed: false });
  });

  it("reports a runtime that fails rather than throwing", async () => {
    const outcome = await runGenerationConformance(createFakeModel({ isAway: true }).generate);

    expect(outcome).toMatchObject({
      passed: false,
      reason: "runs at all: Ollama is not running at http://127.0.0.1:11434.",
    });
  });
});
