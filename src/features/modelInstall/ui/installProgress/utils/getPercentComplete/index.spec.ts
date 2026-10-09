import { describe, expect, it } from "vitest";

import { getPercentComplete } from "./index";

const progressOf = (completedBytes: number, totalBytes: number) => ({
  path: "onnx/model_quantized.onnx",
  completedFiles: 0,
  totalFiles: 1,
  completedBytes,
  totalBytes,
});

describe("getPercentComplete", () => {
  it("rounds the completed share to a whole percentage", () => {
    expect(getPercentComplete(progressOf(1, 3))).toBe(33);
  });

  it("reports nothing done, rather than dividing by zero, before any size is known", () => {
    expect(getPercentComplete(progressOf(0, 0))).toBe(0);
  });

  it("reports a finished download as one hundred", () => {
    expect(getPercentComplete(progressOf(10, 10))).toBe(100);
  });
});
