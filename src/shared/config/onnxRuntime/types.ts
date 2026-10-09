import type { ONNX_RUNTIME_WASM_VARIANTS } from "./constants";

/** Compute path a runtime binary is selected for. */
export type OnnxRuntimeVariant = keyof typeof ONNX_RUNTIME_WASM_VARIANTS;
