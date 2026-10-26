import { describe, expect, it } from "vitest";

import { getCosineSimilarity } from ".";

describe("getCosineSimilarity", () => {
  it("is 1 for the same direction and 0 for orthogonal vectors", () => {
    expect(getCosineSimilarity(new Float32Array([1, 2]), new Float32Array([2, 4]))).toBeCloseTo(1);
    expect(getCosineSimilarity(new Float32Array([1, 0]), new Float32Array([0, 3]))).toBe(0);
  });

  it("is 0 for a zero vector", () => {
    expect(getCosineSimilarity(new Float32Array([0, 0]), new Float32Array([1, 1]))).toBe(0);
  });
});
