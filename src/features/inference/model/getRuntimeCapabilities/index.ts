import type { InferenceDevice } from "@/shared/modelManifest";
import { getAvailableDevices } from "../getAvailableDevices";

/** What this installation can actually run, as the runtime reports it. */
export interface RuntimeCapabilities {
  /** Reachable compute paths, best first. */
  availableDevices: InferenceDevice[];
  /**
   * Whether this realm is cross-origin isolated. False in a Firefox extension,
   * which is what denies the runtime `SharedArrayBuffer` and pins it to one
   * thread. Reported rather than assumed, so a platform change shows up as a
   * number rather than as a mysterious speed-up.
   */
  crossOriginIsolated: boolean;
  /** Threads the runtime will actually use. */
  threadCount: number;
}

/**
 * Reports what the runtime can do here, before any model is involved.
 *
 * Separated from the worker that calls it so the reasoning carries tests: the
 * relationship between isolation and thread count is the single most
 * consequential fact about in-extension inference, and it should not live in an
 * entrypoint.
 */
export const getRuntimeCapabilities = async (
  gpu: { requestAdapter: () => Promise<unknown> } | undefined,
  isCrossOriginIsolated: boolean,
): Promise<RuntimeCapabilities> => {
  return {
    availableDevices: await getAvailableDevices(gpu),
    crossOriginIsolated: isCrossOriginIsolated,
    // Multiple threads require SharedArrayBuffer, which requires cross-origin
    // isolation. Without it the runtime would request threads, find none, and
    // fall back silently; stating one here makes that a decision.
    threadCount: isCrossOriginIsolated ? navigator.hardwareConcurrency : 1,
  };
};
