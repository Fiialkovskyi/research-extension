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
  isBusy: boolean;
  /** Which compute path to use, chosen rather than defaulted. */
  device: InferenceDevice;
  benchmark?: BenchmarkResult;
  probes: readonly ProbeResult[];
  /** A model's checks are running, so the list of them is about to be replaced. */
  isChecking: boolean;
  /** Origins the package declares it may reach, once the background has said. */
  permittedOrigins?: readonly string[];
  /** Origins the policy has refused. Empty is a result, not an absence. */
  blockedOrigins: readonly BlockedRequestReport[];
  /** A request that was refused, shown rather than swallowed. */
  problem?: string;
}

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
