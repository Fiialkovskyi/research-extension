import type { InferenceDevice } from "../../../../shared/modelManifest";

/**
 * The part of `navigator.gpu` this check needs.
 *
 * Declared structurally rather than against the WebGPU typings so the check
 * compiles on a toolchain whose DOM library predates them — which is the same
 * situation the add-on's declared minimum Firefox is in.
 */
interface GpuLike {
  requestAdapter: () => Promise<unknown>;
}

/**
 * Reports which compute paths are actually reachable here, newest first.
 *
 * Presence of `navigator.gpu` is not enough: the object exists on platforms
 * where no adapter can be acquired, so the only honest check is to ask for one.
 * WebAssembly is always reachable because its runtime ships in the package.
 */
export const getAvailableDevices = async (gpu: GpuLike | undefined): Promise<InferenceDevice[]> => {
  if (gpu === undefined) {
    return ["wasm"];
  }

  const adapter = await gpu.requestAdapter().catch(() => null);

  return adapter === null || adapter === undefined ? ["wasm"] : ["webgpu", "wasm"];
};
