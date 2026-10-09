import { describe, expect, it } from "vitest";

import { getModelDtype } from ".";
import { SUPPORTED_QUANTIZATIONS } from "../../../../constants";

describe("getModelDtype", () => {
  it.each([...SUPPORTED_QUANTIZATIONS])("accepts %s", (quantization) => {
    expect(getModelDtype(quantization)).toBe(quantization);
  });

  it("accepts the quantization the default profile installs", () => {
    expect(getModelDtype("q8")).toBe("q8");
  });

  it.each([
    ["an unknown name", "q3"],
    ["a file name", "model_quantized.onnx"],
    ["an empty string", ""],
    ["nothing at all", undefined],
    ["a differently cased name", "Q8"],
  ])("refuses %s rather than requesting a file that was never installed", (_label, value) => {
    expect(() => getModelDtype(value)).toThrow(/Unsupported quantization/);
  });

  it("lists the variants it does accept, so the profile can be corrected", () => {
    expect(() => getModelDtype("nonsense")).toThrow(/q8/);
  });
});
