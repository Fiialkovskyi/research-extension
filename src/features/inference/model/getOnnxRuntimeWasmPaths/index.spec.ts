import { describe, expect, it } from "vitest";

import { getOnnxRuntimeWasmPaths } from ".";

const base = "moz-extension://abc/";

describe("getOnnxRuntimeWasmPaths", () => {
  it("points the software path at the plain build", () => {
    expect(getOnnxRuntimeWasmPaths("wasm", base)).toEqual({
      mjs: `${base}ort/ort-wasm-simd-threaded.mjs`,
      wasm: `${base}ort/ort-wasm-simd-threaded.wasm`,
    });
  });

  it("points the accelerated path at the JSEP build", () => {
    expect(getOnnxRuntimeWasmPaths("webgpu", base)).toEqual({
      mjs: `${base}ort/ort-wasm-simd-threaded.jsep.mjs`,
      wasm: `${base}ort/ort-wasm-simd-threaded.jsep.wasm`,
    });
  });

  it("gives the two paths different binaries, which is the point of shipping both", () => {
    expect(getOnnxRuntimeWasmPaths("wasm", base).wasm).not.toBe(
      getOnnxRuntimeWasmPaths("webgpu", base).wasm,
    );
  });

  it.each(["wasm", "webgpu"] as const)(
    "resolves %s inside the package, never remotely",
    (variant) => {
      const paths = getOnnxRuntimeWasmPaths(variant, base);

      for (const path of Object.values(paths)) {
        expect(path.startsWith(base)).toBe(true);
        expect(path).not.toContain("cdn.");
        expect(path).not.toContain("jsdelivr");
      }
    },
  );

  it("works from a relative base, for a worker resolving against itself", () => {
    expect(getOnnxRuntimeWasmPaths("wasm", "./").wasm).toBe("./ort/ort-wasm-simd-threaded.wasm");
  });
});
