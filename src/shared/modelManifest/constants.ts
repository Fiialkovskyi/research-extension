/** Model families the add-on can use. Optional families from the spec arrive with their features. */
export const MODEL_FAMILIES = ["embedding", "text-generation"] as const;

/** Compute paths a provider can report actually having used. */
export const INFERENCE_DEVICES = ["webgpu", "wasm", "cpu"] as const;
