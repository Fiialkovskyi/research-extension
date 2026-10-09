import {
  ONNX_RUNTIME_DIRECTORY,
  ONNX_RUNTIME_WASM_VARIANTS,
  type OnnxRuntimeVariant,
} from "@/shared/config/onnxRuntime";

/** Where the runtime should load its loader module and binary from. */
export interface OnnxRuntimeWasmPaths {
  mjs: string;
  wasm: string;
}

/**
 * Resolves the packaged runtime binaries for one compute path.
 *
 * The library would otherwise point these at a public CDN, pinned to the
 * pre-release `onnxruntime-web` it depends on — a request our policy blocks and
 * a version that may not be published there at all. So the paths are always
 * ours, and they are package-relative rather than absolute: the worker resolves
 * them against its own location, which is inside the extension.
 *
 * @param variant which compute path the binaries are for.
 * @param base location the paths are relative to, ending in a slash.
 */
export const getOnnxRuntimeWasmPaths = (
  variant: OnnxRuntimeVariant,
  base: string,
): OnnxRuntimeWasmPaths => {
  const stem = ONNX_RUNTIME_WASM_VARIANTS[variant];
  const directory = `${base}${ONNX_RUNTIME_DIRECTORY}/`;

  return { mjs: `${directory}${stem}.mjs`, wasm: `${directory}${stem}.wasm` };
};
