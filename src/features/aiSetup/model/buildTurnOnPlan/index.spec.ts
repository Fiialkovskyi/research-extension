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
      entry({ name: "qwen3:4b", family: "text-generation", isPulled: false, size: "2.5 GB" }),
    ]);

    expect(plan.steps.map(({ name, family }) => [name, family])).toEqual([
      ["nomic-embed-text", "embedding"],
      ["qwen3:4b", "text-generation"],
    ]);
    expect(plan.downloadBytes).toBe(274e6 + 2.5e9);
  });

  it("uses a model Ollama already has under its own tag, without downloading it", () => {
    const plan = buildTurnOnPlan([
      entry({ name: "nomic-embed-text:latest" }),
      entry({ name: "qwen3:4b", family: "text-generation", isPulled: false }),
    ]);

    expect(plan.steps[0]).toEqual({
      name: "nomic-embed-text:latest",
      family: "embedding",
      isPulled: true,
      downloadBytes: 0,
    });
    expect(plan.downloadBytes).toBe(2.5e9);
  });

  it("leaves out a family whose model is already active", () => {
    const plan = buildTurnOnPlan([
      entry({ name: "all-minilm:latest", isActive: true }),
      entry({ name: "qwen3:4b", family: "text-generation" }),
    ]);

    expect(plan.steps.map(({ name }) => name)).toEqual(["qwen3:4b"]);
    expect(plan.downloadBytes).toBe(0);
  });

  it("plans nothing when both families are on", () => {
    expect(
      buildTurnOnPlan([
        entry({ name: "nomic-embed-text:latest", isActive: true }),
        entry({ name: "qwen3:4b", family: "text-generation", isActive: true }),
      ]).steps,
    ).toEqual([]);
  });
});
