import { describe, expect, it } from "vitest";

import { getCosineSimilarity } from ".";

describe("getCosineSimilarity", () => {
  it("reports an identical pair as one", () => {
    const vector = new Float32Array([1, 2, 3]);

    expect(getCosineSimilarity(vector, vector)).toBeCloseTo(1, 6);
  });

  it("reports an orthogonal pair as zero", () => {
    expect(getCosineSimilarity(new Float32Array([1, 0]), new Float32Array([0, 1]))).toBe(0);
  });

  it("reports an opposed pair as minus one", () => {
    expect(getCosineSimilarity(new Float32Array([1, 0]), new Float32Array([-1, 0]))).toBeCloseTo(
      -1,
      6,
    );
  });

  it("ignores magnitude, so an unnormalized pair still scores one", () => {
    // This is what lets the normalization probe fail independently.
    expect(getCosineSimilarity(new Float32Array([1, 1]), new Float32Array([5, 5]))).toBeCloseTo(
      1,
      6,
    );
  });

  it("reports zero for a degenerate vector rather than a misleading number", () => {
    expect(getCosineSimilarity(new Float32Array([0, 0]), new Float32Array([1, 1]))).toBe(0);
  });

  it("reports zero when both vectors are degenerate", () => {
    expect(getCosineSimilarity(new Float32Array([0, 0]), new Float32Array([0, 0]))).toBe(0);
  });

  it("refuses vectors of different widths", () => {
    expect(() =>
      getCosineSimilarity(new Float32Array([1, 2]), new Float32Array([1, 2, 3])),
    ).toThrow(/2-dimensional.*3-dimensional/);
  });

  it("is symmetric", () => {
    const left = new Float32Array([0.2, 0.9, -0.3]);
    const right = new Float32Array([0.5, 0.1, 0.8]);

    expect(getCosineSimilarity(left, right)).toBeCloseTo(getCosineSimilarity(right, left), 10);
  });
});
