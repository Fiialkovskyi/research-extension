import { describe, expect, it } from "vitest";

import { ONNX_RUNTIME_DIRECTORY, ONNX_RUNTIME_WASM_VARIANTS } from ".";

describe("onnx runtime configuration", () => {
  it("names a package-relative directory, never a remote origin", () => {
    expect(ONNX_RUNTIME_DIRECTORY).not.toContain("//");
    expect(ONNX_RUNTIME_DIRECTORY.startsWith("/")).toBe(false);
  });

  it("ships a variant for each compute path we measure", () => {
    expect(Object.keys(ONNX_RUNTIME_WASM_VARIANTS)).toEqual(["wasm", "webgpu"]);
  });

  it("names variants as bare stems, so a loader and a binary extension can be appended", () => {
    for (const stem of Object.values(ONNX_RUNTIME_WASM_VARIANTS)) {
      expect(stem).not.toMatch(/\.(wasm|mjs)$/);
    }
  });
});
