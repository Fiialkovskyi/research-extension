import { describe, expect, it } from "vitest";

import { splitEmbeddingRows } from ".";

describe("splitEmbeddingRows", () => {
  it("cuts a batch into one vector per text", () => {
    const rows = splitEmbeddingRows(new Float32Array([1, 2, 3, 4, 5, 6]), 2, 3);

    expect(rows).toHaveLength(2);
    expect([...(rows[0] ?? [])]).toEqual([1, 2, 3]);
    expect([...(rows[1] ?? [])]).toEqual([4, 5, 6]);
  });

  it("handles a single text", () => {
    expect([...(splitEmbeddingRows(new Float32Array([1, 2]), 1, 2)[0] ?? [])]).toEqual([1, 2]);
  });

  it("returns nothing for an empty batch", () => {
    expect(splitEmbeddingRows(new Float32Array([]), 0, 384)).toEqual([]);
  });

  it("copies each row rather than viewing the batch buffer", () => {
    const data = new Float32Array([1, 2, 3, 4]);
    const [first] = splitEmbeddingRows(data, 2, 2);

    data[0] = 99;

    expect(first?.[0]).toBe(1);
  });

  it("gives each row its own buffer, so one can be released without the others", () => {
    const [first, second] = splitEmbeddingRows(new Float32Array([1, 2, 3, 4]), 2, 2);

    expect(first?.buffer).not.toBe(second?.buffer);
  });

  it.each([
    ["too few values", new Float32Array([1, 2, 3]), 2, 2],
    ["too many values", new Float32Array([1, 2, 3, 4, 5]), 2, 2],
  ])("refuses %s rather than producing mis-sized vectors", (_label, data, rows, dimensions) => {
    expect(() => splitEmbeddingRows(data, rows, dimensions)).toThrow(/returned/);
  });

  it("names both the expected and the actual count, so the mismatch is diagnosable", () => {
    expect(() => splitEmbeddingRows(new Float32Array([1]), 2, 384)).toThrow(/768.*returned 1/s);
  });
});
