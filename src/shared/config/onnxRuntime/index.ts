/**
 * Where the ONNX Runtime WebAssembly binaries live inside the package.
 *
 * Transformers.js otherwise resolves them from a public CDN, pinned to the
 * exact `onnxruntime-web` version it depends on — which is a pre-release build
 * that may not be published there at all. Under our content security policy
 * that request is blocked outright, and permitting it would break the
 * no-remote-code guarantee. So the binaries ship with the add-on, and
 * `scripts/syncOnnxRuntime.ts` copies them out of `node_modules` at build time
 * from these same constants.
 */

/** Directory inside the package holding the copied runtime binaries. */
export const ONNX_RUNTIME_DIRECTORY = "ort";

/**
 * Build variants we ship, keyed by the compute path that needs each one.
 *
 * Two rather than one because they are not interchangeable. The plain build has
 * no WebGPU support at all — requesting that device against it fails with
 * `webgpuInit is not a function`, which names the symptom and not the cause.
 * The JSEP build is the one that carries it.
 *
 * The plain build is still the right choice for the CPU path: it is half the
 * size and carries none of the accelerator plumbing, and the CPU number is the
 * one every NFR budget is measured against, since the declared minimum Firefox
 * has no WebGPU on any platform.
 */
export const ONNX_RUNTIME_WASM_VARIANTS = {
  wasm: "ort-wasm-simd-threaded",
  webgpu: "ort-wasm-simd-threaded.jsep",
} as const;

export type { OnnxRuntimeVariant } from "./types";
