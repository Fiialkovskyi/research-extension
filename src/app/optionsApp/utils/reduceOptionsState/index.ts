import type { OptionsEvent, OptionsState } from "./types";

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
        isBusy: true,
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
      return { ...state, isBusy: true, problem: undefined, probes: [] };
    }

    case "benchmark-requested": {
      return { ...state, isBusy: true, problem: undefined, benchmark: undefined };
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
      return { ...state, isBusy: false, problem: event.payload.reason };
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
        isBusy: false,
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
        isBusy: false,
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
        isBusy: false,
        probes: event.payload.probes,
        // A refusal is reported even though the request itself succeeded: the
        // model was not activated, and saying nothing would imply it was.
        problem: event.payload.active ? undefined : event.payload.reason,
      };
    }

    case "model.activationFailed":
    case "benchmark.failed": {
      return { ...state, isBusy: false, problem: event.payload.reason };
    }

    case "benchmark.measured": {
      return { ...state, isBusy: false, benchmark: event.payload };
    }
  }
};
