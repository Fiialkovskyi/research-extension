import { describe, expect, it } from "vitest";

import { getVectorNorm } from ".";

describe("getVectorNorm", () => {
  it("measures a unit vector as one", () => {
    expect(getVectorNorm(new Float32Array([1, 0, 0]))).toBe(1);
  });

  it("measures a known right triangle", () => {
    expect(getVectorNorm(new Float32Array([3, 4]))).toBe(5);
  });

  it("measures an unnormalized vector as longer than one", () => {
    expect(getVectorNorm(new Float32Array([1, 1]))).toBeCloseTo(Math.SQRT2, 6);
  });

  it("measures the zero vector as zero", () => {
    expect(getVectorNorm(new Float32Array([0, 0, 0]))).toBe(0);
  });

  it("ignores the sign of each component", () => {
    expect(getVectorNorm(new Float32Array([-3, 4]))).toBe(5);
  });

  it("measures an empty vector as zero rather than failing", () => {
    expect(getVectorNorm(new Float32Array([]))).toBe(0);
  });
});
