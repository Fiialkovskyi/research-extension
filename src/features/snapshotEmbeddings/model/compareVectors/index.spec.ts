import { describe, expect, it } from "vitest";

import { compareVectors } from ".";
import { EmbeddingSpaceMismatchError } from "../../errors";

const vector = (spaceId: string, ...values: number[]) => ({
  spaceId,
  vector: new Float32Array(values),
});

describe("compareVectors", () => {
  it("gives the cosine similarity of two vectors of one space", () => {
    expect(compareVectors(vector("s", 1, 0), vector("s", 1, 0))).toBeCloseTo(1);
    expect(compareVectors(vector("s", 1, 0), vector("s", 0, 1))).toBeCloseTo(0);
    expect(compareVectors(vector("s", 1, 1), vector("s", 2, 2))).toBeCloseTo(1);
    expect(compareVectors(vector("s", 1, 0), vector("s", -1, 0))).toBeCloseTo(-1);
  });

  it("refuses to compare vectors of different spaces", () => {
    expect(() => compareVectors(vector("a", 1, 0), vector("b", 1, 0))).toThrow(
      EmbeddingSpaceMismatchError,
    );
  });

  it("gives 0 for a zero vector rather than dividing by zero", () => {
    expect(compareVectors(vector("s", 0, 0), vector("s", 1, 0))).toBe(0);
  });
});
