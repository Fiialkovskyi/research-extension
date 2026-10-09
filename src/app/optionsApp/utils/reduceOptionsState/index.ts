import type { BlockedRequestReport } from "@/features/diagnostics";
import type { RuntimeCapabilities } from "@/features/inference";
import type { ThroughputMeasurement } from "@/features/inferenceBenchmark";
import type { InstallProgress } from "@/features/modelInstall";
import type { InstallState } from "@/features/modelInstall/ui/installProgress";
import type { InstalledModelSummary } from "@/features/modelRegistry";
import type { ProbeResult } from "@/features/modelConformance";
import type { InferenceDevice } from "@/shared/modelManifest";
import type { RpcRejection } from "@/shared/rpc";

/** A measurement together with what it has to be read alongside. */
export type BenchmarkResult = ThroughputMeasurement & { threadCount: number };

/** Everything the options surface renders. */
export interface OptionsState {
  capabilities?: RuntimeCapabilities;
  models: readonly InstalledModelSummary[];
  install: InstallState;
  /**
   * A long operation is in flight. One flag rather than one per operation:
   * installing, activating and measuring all contend for the single inference
   * worker, so allowing two at once would only produce a confusing failure.
   */
  busy: boolean;
  /** Which compute path to use, chosen rather than defaulted. */
  device: InferenceDevice;
  benchmark?: BenchmarkResult;
  probes: readonly ProbeResult[];
  /** Origins the package declares it may reach, once the background has said. */
  permittedOrigins?: readonly string[];
  /** Origins the policy has refused. Empty is a result, not an absence. */
  blockedOrigins: readonly BlockedRequestReport[];
  /** A request that was refused, shown rather than swallowed. */
  problem?: string;
}

export const INITIAL_OPTIONS_STATE: OptionsState = {
  models: [],
  install: { status: "idle" },
  busy: false,
  // The software path is the default because it is the one every supported
  // platform has, and therefore the one the budgets are judged against.
  device: "wasm",
  probes: [],
  blockedOrigins: [],
};

/**
 * What can change the surface: the user asking for something, or the background
 * answering.
 *
 * The background's messages keep their own type names, so this union is the
 * protocol rather than a translation of it — one fewer place for the two to
 * drift apart.
 */
export type OptionsEvent =
  | { type: "device-selected"; device: InferenceDevice }
  | { type: "install-requested"; repository: string }
  | { type: "activation-requested"; ref: string }
  | { type: "benchmark-requested"; ref: string }
  | { type: "inference.capabilities"; payload: RuntimeCapabilities }
  | {
      type: "diagnostics.report";
      payload: { blocked: BlockedRequestReport[]; permittedOrigins: string[] };
    }
  | { type: "inference.failed"; payload: { reason: string } }
  | { type: "rpc.refused"; payload: { rejection: RpcRejection; reason: string } }
  | { type: "rpc.failed"; payload: { requestType: string; reason: string } }
  | { type: "model.listed"; payload: { models: InstalledModelSummary[] } }
  | { type: "model.installProgress"; payload: InstallProgress }
  | { type: "model.installed"; payload: { ref: string; diskBytes: number } }
  | { type: "model.installFailed"; payload: { repository: string; reason: string } }
  | {
      type: "model.activated";
      payload: { ref: string; active: boolean; reason?: string; probes: ProbeResult[] };
    }
  | { type: "model.activationFailed"; payload: { ref: string; reason: string } }
  | { type: "benchmark.measured"; payload: BenchmarkResult & { ref: string } }
  | { type: "benchmark.failed"; payload: { ref: string; reason: string } };

/**
 * Folds an event into the surface's state.
 *
 * Pure, so the awkward sequences carry tests rather than hope: progress
 * arriving after a failure, a refusal during an install, a second install
 * starting while the first is still on screen. Those orderings are what a
 * streamed protocol actually produces, and getting them wrong leaves a surface
 * claiming something that is not happening.
 */
export const reduceOptionsState = (state: OptionsState, event: OptionsEvent): OptionsState => {
  switch (event.type) {
    case "device-selected": {
      // The previous measurement was taken on the other path, so keeping it on
      // screen beside a new choice would invite reading it as this one's.
      return { ...state, device: event.device, benchmark: undefined };
    }

    case "install-requested": {
      return {
        ...state,
        busy: true,
        // Cleared deliberately: a previous attempt's outcome must not stay on
        // screen beside a new attempt's progress.
        problem: undefined,
        install: {
          status: "running",
          progress: {
            path: "",
            completedFiles: 0,
            totalFiles: 0,
            completedBytes: 0,
            totalBytes: 0,
          },
        },
      };
    }

    case "activation-requested": {
      return { ...state, busy: true, problem: undefined, probes: [] };
    }

    case "benchmark-requested": {
      return { ...state, busy: true, problem: undefined, benchmark: undefined };
    }

    case "inference.capabilities": {
      return { ...state, capabilities: event.payload };
    }

    case "diagnostics.report": {
      return {
        ...state,
        permittedOrigins: event.payload.permittedOrigins,
        blockedOrigins: event.payload.blocked,
      };
    }

    case "inference.failed":
    case "rpc.refused":
    case "rpc.failed": {
      return { ...state, busy: false, problem: event.payload.reason };
    }

    case "model.listed": {
      return { ...state, models: event.payload.models };
    }

    case "model.installProgress": {
      // Ignored unless an install is running: progress that arrives after a
      // failure would otherwise resurrect a finished attempt.
      if (state.install.status !== "running") {
        return state;
      }

      return { ...state, install: { status: "running", progress: event.payload } };
    }

    case "model.installed": {
      return {
        ...state,
        busy: false,
        install: {
          status: "installed",
          ref: event.payload.ref,
          diskBytes: event.payload.diskBytes,
        },
      };
    }

    case "model.installFailed": {
      return {
        ...state,
        busy: false,
        install: {
          status: "failed",
          repository: event.payload.repository,
          reason: event.payload.reason,
        },
      };
    }

    case "model.activated": {
      return {
        ...state,
        busy: false,
        probes: event.payload.probes,
        // A refusal is reported even though the request itself succeeded: the
        // model was not activated, and saying nothing would imply it was.
        problem: event.payload.active ? undefined : event.payload.reason,
      };
    }

    case "model.activationFailed":
    case "benchmark.failed": {
      return { ...state, busy: false, problem: event.payload.reason };
    }

    case "benchmark.measured": {
      return { ...state, busy: false, benchmark: event.payload };
    }
  }
};
