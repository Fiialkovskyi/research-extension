import { describe, expect, it } from "vitest";

import { buildProbeResults } from ".";
import { MINIMUM_ORDERED_PROBES, PARAPHRASE_PROBES } from "../../../../constants";
import type { EmbeddingContract } from "@/shared/modelManifest";

const DIMENSIONS = 4;

const contract = (overrides: Partial<EmbeddingContract> = {}): EmbeddingContract => ({
  family: "embedding",
  dimensions: DIMENSIONS,
  maxInputTokens: 512,
  pooling: "mean",
  normalize: true,
  similarity: "cosine",
  prefixes: { query: "", document: "" },
  ...overrides,
});

const unit = (values: readonly number[]): Float32Array => {
  const norm = Math.sqrt(values.reduce((total, value) => total + value * value, 0));

  return new Float32Array(values.map((value) => value / norm));
};

/**
 * Vectors shaped like a working model's: each paraphrase almost parallel to its
 * anchor, each stranger orthogonal to it.
 */
const buildVectors = (count: number, wrongPairs = 0) => {
  const anchors: Float32Array[] = [];
  const others: Float32Array[] = [];

  for (let index = 0; index < count; index += 1) {
    const buildVectorAtAngle = (index * Math.PI) / count;
    const anchor = unit([Math.cos(buildVectorAtAngle), Math.sin(buildVectorAtAngle), 0, 0]);
    const near = unit([
      Math.cos(buildVectorAtAngle + 0.01),
      Math.sin(buildVectorAtAngle + 0.01),
      0,
      0,
    ]);
    const far = unit([0, 0, Math.cos(buildVectorAtAngle), Math.sin(buildVectorAtAngle)]);

    anchors.push(anchor);

    // Swapping the pair makes the stranger the closer of the two, which is
    // what a broken or unfamiliar model looks like on this probe.
    others.push(...(index < wrongPairs ? [far, near] : [near, far]));
  }

  return { anchors, others };
};

const buildProbe = (results: ReturnType<typeof buildProbeResults>, name: string) =>
  results.find((probe) => probe.name.includes(name));

const probeCount = PARAPHRASE_PROBES.length;

describe("buildProbeResults", () => {
  it("passes every probe for a well-behaved model", () => {
    const { anchors, others } = buildVectors(probeCount);

    expect(buildProbeResults(contract(), anchors, others).every((probe) => probe.passed)).toBe(
      true,
    );
  });

  it("fails when the model returned fewer vectors than texts", () => {
    const { anchors, others } = buildVectors(probeCount);

    const results = buildProbeResults(contract(), anchors.slice(0, 5), others);

    expect(buildProbe(results, "one vector per text")?.passed).toBe(false);
  });

  it("names the counts it expected and received", () => {
    const { anchors, others } = buildVectors(probeCount);

    const results = buildProbeResults(contract(), anchors, others.slice(0, 2));

    expect(buildProbe(results, "one vector per text")?.detail).toMatch(/Expected \d+ vectors/);
  });

  it("fails when a vector does not match the declared dimensionality", () => {
    const { anchors, others } = buildVectors(probeCount);
    const mangled = [new Float32Array(DIMENSIONS + 1), ...anchors.slice(1)];

    const results = buildProbeResults(contract(), mangled, others);

    expect(buildProbe(results, "declared dimensionality")?.passed).toBe(false);
    expect(buildProbe(results, "declared dimensionality")?.detail).toContain(
      String(DIMENSIONS + 1),
    );
  });

  it("fails when a model declaring normalization returns longer vectors", () => {
    const { anchors, others } = buildVectors(probeCount);
    const unnormalized = anchors.map((vector) => vector.map((value) => value * 3));

    const results = buildProbeResults(contract(), unnormalized, others);

    expect(buildProbe(results, "normalizes as declared")?.passed).toBe(false);
  });

  it("does not judge normalization a model never declared", () => {
    const { anchors, others } = buildVectors(probeCount);
    const unnormalized = anchors.map((vector) => vector.map((value) => value * 3));

    const results = buildProbeResults(contract({ normalize: false }), unnormalized, others);

    expect(buildProbe(results, "normalizes as declared")).toBeUndefined();
    expect(results.every((probe) => probe.passed)).toBe(true);
  });

  it("fails ordering when too few pairs come out the right way round", () => {
    const { anchors, others } = buildVectors(probeCount, probeCount - MINIMUM_ORDERED_PROBES + 1);

    const results = buildProbeResults(contract(), anchors, others);

    expect(buildProbe(results, "paraphrase closer")?.passed).toBe(false);
  });

  it("passes ordering at exactly the required number", () => {
    const { anchors, others } = buildVectors(probeCount, probeCount - MINIMUM_ORDERED_PROBES);

    const results = buildProbeResults(contract(), anchors, others);

    expect(buildProbe(results, "paraphrase closer")?.passed).toBe(true);
  });

  it("reports how many pairs were ordered, not just the verdict", () => {
    const { anchors, others } = buildVectors(probeCount);

    expect(
      buildProbe(buildProbeResults(contract(), anchors, others), "paraphrase closer")?.detail,
    ).toMatch(new RegExp(`${probeCount} of ${probeCount}`));
  });

  it("does not judge ordering when a structural probe already failed", () => {
    // Comparing mis-sized vectors would throw, or worse, produce a number.
    const { anchors, others } = buildVectors(probeCount);
    const mangled = [new Float32Array(DIMENSIONS + 1), ...anchors.slice(1)];

    const results = buildProbeResults(contract(), mangled, others);

    expect(buildProbe(results, "paraphrase closer")).toBeUndefined();
  });

  it("fails the count probe for a model that returned nothing", () => {
    const results = buildProbeResults(contract(), [], []);

    expect(buildProbe(results, "one vector per text")?.passed).toBe(false);
    expect(buildProbe(results, "paraphrase closer")).toBeUndefined();
  });

  it("fails the count probe when the two roles come back lopsided", () => {
    const { anchors, others } = buildVectors(probeCount);

    const results = buildProbeResults(contract(), anchors, others.slice(0, probeCount));

    expect(buildProbe(results, "one vector per text")?.passed).toBe(false);
  });
});
