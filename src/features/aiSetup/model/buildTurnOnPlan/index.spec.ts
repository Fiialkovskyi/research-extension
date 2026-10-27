import { describe, expect, it } from "vitest";

import { buildTurnOnPlan } from ".";
import type { OllamaModelEntry } from "@/features/ollama";

const entry = (overrides: Partial<OllamaModelEntry> & { name: string }): OllamaModelEntry => ({
  family: "embedding",
  isPulled: true,
  isRecommended: true,
  size: "",
  registeredRef: null,
  isActive: false,
  ...overrides,
});

describe("buildTurnOnPlan", () => {
  it("downloads both recommended models, embedding first, when Ollama has neither", () => {
    const plan = buildTurnOnPlan([
      entry({ name: "nomic-embed-text", isPulled: false, size: "274 MB" }),
      entry({ name: "gemma4:12b", family: "text-generation", isPulled: false, size: "7.7 GB" }),
    ]);

    expect(plan.steps.map(({ name, family }) => [name, family])).toEqual([
      ["nomic-embed-text", "embedding"],
      ["gemma4:12b", "text-generation"],
    ]);
    expect(plan.downloadBytes).toBe(274e6 + 7.7e9);
  });

  it("uses a model Ollama already has under its own tag, without downloading it", () => {
    const plan = buildTurnOnPlan([
      entry({ name: "nomic-embed-text:latest" }),
      entry({ name: "gemma4:12b", family: "text-generation", isPulled: false }),
    ]);

    expect(plan.steps[0]).toEqual({
      name: "nomic-embed-text:latest",
      family: "embedding",
      isPulled: true,
      downloadBytes: 0,
    });
    expect(plan.downloadBytes).toBe(7.7e9);
  });

  it("leaves out a family whose model is already active", () => {
    const plan = buildTurnOnPlan([
      entry({ name: "all-minilm:latest", isActive: true }),
      entry({ name: "gemma4:12b", family: "text-generation" }),
    ]);

    expect(plan.steps.map(({ name }) => name)).toEqual(["gemma4:12b"]);
    expect(plan.downloadBytes).toBe(0);
  });

  it("plans nothing when both families are on", () => {
    expect(
      buildTurnOnPlan([
        entry({ name: "nomic-embed-text:latest", isActive: true }),
        entry({ name: "gemma4:12b", family: "text-generation", isActive: true }),
      ]).steps,
    ).toEqual([]);
  });
});
