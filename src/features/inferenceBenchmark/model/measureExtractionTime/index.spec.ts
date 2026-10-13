import { describe, expect, it, vi } from "vitest";

import { measureExtractionTime } from ".";
import type { GenerateRequest, GenerationStream } from "@/features/inference";

const ROWS = [
  { name: "Volta E5", priceUsd: 2399, weightKg: 23.5, batteryWh: 500, torqueNm: 85, rangeKm: 96 },
  // One wrong value: the price of the larger battery, not the bike.
  {
    name: "Corsa Urban 2",
    priceUsd: 499,
    weightKg: 19.8,
    batteryWh: 418,
    torqueNm: 45,
    rangeKm: 64,
  },
  {
    name: "Halden Step",
    priceUsd: 2099,
    weightKg: 21.2,
    batteryWh: 540,
    torqueNm: 65,
    rangeKm: 88,
  },
];
const FACTS = JSON.stringify({ products: ROWS });

/** A model that answers `text` and finishes. */
const answering = (text: string) =>
  vi.fn((_request: GenerateRequest): GenerationStream => ({
    async *[Symbol.asyncIterator]() {
      yield { delta: text };
    },
    final: () => Promise.resolve({ text, device: "local-server", stoppedBecause: "model" }),
  }));

/** A clock that advances by `stepMs` each time it is read. */
const createClock = (stepMs: number) => {
  let time = 0;

  return () => {
    time += stepMs;

    return time;
  };
};

describe("measureExtractionTime", () => {
  it("times a comparison-table extraction from a page of about 1,500 words, and checks it", async () => {
    const generate = answering(FACTS);
    const measured = await measureExtractionTime(generate, createClock(12_000));

    expect(measured).toEqual({
      wordCount: expect.any(Number),
      durationMs: 12_000,
      isValid: true,
      correctCount: 14,
      expectedCount: 15,
      meetsBudget: true,
    });
    expect(measured.wordCount).toBeGreaterThan(1_400);
    expect(measured.wordCount).toBeLessThan(1_600);
    expect(generate.mock.calls[0]?.[0]).toMatchObject({
      temperature: 0,
      responseSchema: { required: ["products"] },
    });
  });

  it("is over budget when slower than 20 s", async () => {
    await expect(
      measureExtractionTime(answering(FACTS), createClock(25_000)),
    ).resolves.toMatchObject({ isValid: true, meetsBudget: false });
  });

  it("never meets the budget with an answer it had to discard", async () => {
    await expect(
      measureExtractionTime(answering("The Volta is heavy."), createClock(1_000)),
    ).resolves.toMatchObject({
      isValid: false,
      correctCount: 0,
      reason: "The answer was not JSON.",
      meetsBudget: false,
    });
  });

  it("finds a product by a name that includes the brand", async () => {
    const branded = JSON.stringify({
      products: ROWS.map((row) => ({ ...row, name: `The ${row.name} e-bike` })),
    });

    await expect(
      measureExtractionTime(answering(branded), createClock(1_000)),
    ).resolves.toMatchObject({ correctCount: 14 });
  });
});
