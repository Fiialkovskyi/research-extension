/** Model families the add-on can use. Optional families from the spec arrive with their features. */
export const MODEL_FAMILIES = ["embedding", "text-generation"] as const;

/** Compute paths a provider can report actually having used. */
/**
 * Where inference ran. `local-server` is a local inference server such as
 * Ollama, on whatever hardware it chose — not the extension's own runtime.
 */
export const INFERENCE_DEVICES = ["webgpu", "wasm", "cpu", "local-server"] as const;
