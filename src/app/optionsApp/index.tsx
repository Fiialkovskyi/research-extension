import { useEffect, useReducer } from "react";

import { diagnosticsResponseSchemas } from "@/features/diagnostics";
import { PolicyReport } from "@/features/diagnostics/ui/policyReport";
import { inferenceResponseSchemas } from "@/features/inference";
import { benchmarkResponseSchemas } from "@/features/inferenceBenchmark";
import { BenchmarkReport } from "@/features/inferenceBenchmark/ui/benchmarkReport";
import { modelInstallResponseSchemas } from "@/features/modelInstall";
import { InstallProgress } from "@/features/modelInstall/ui/installProgress";
import { modelRegistryResponseSchemas } from "@/features/modelRegistry";
import type { ProbeResult } from "@/features/modelConformance";
import { ModelList } from "@/features/modelRegistry/ui/modelList";
import type { OllamaPlatform } from "@/features/ollama";
import { OllamaCard } from "@/features/ollama/ui/ollamaCard";
import { BUNDLED_MODEL_PROFILES, type ModelProfile } from "@/shared/config";
import type { InferenceDevice } from "@/shared/modelManifest";
import { Button, StatusDot } from "@/shared/ui";
import {
  buildRpcMessage,
  parseRpcMessage,
  type RpcMessage,
  RpcMessageError,
  rpcResponseSchemas,
} from "@/shared/rpc";
import { INITIAL_OPTIONS_STATE } from "./utils/reduceOptionsState/constants";
import { reduceOptionsState } from "./utils/reduceOptionsState";
import type { OptionsEvent } from "./utils/reduceOptionsState/types";

/**
 * The surface's end of its connection to the background.
 *
 * Declared structurally so the whole surface is rendered and driven in tests
 * without an extension runtime; the entrypoint supplies the real port.
 */
export interface SurfaceClient {
  send: (message: RpcMessage<string, unknown>) => void;
  /** Registers a listener and returns the function that removes it. */
  subscribe: (listener: (message: unknown) => void) => () => void;
}

export interface OptionsAppProps {
  client: SurfaceClient;
  /** Profiles offered for installation. Defaults to the ones that ship. */
  profiles?: readonly ModelProfile[];
  /**
   * Asks for access to the local Ollama server, within the user's click.
   * Without one, connecting is refused, as it would be outside an extension.
   */
  requestOllamaAccess?: () => Promise<boolean>;
  /**
   * This installation's origin and operating system, which the command that
   * lets Ollama trust the extension is written for.
   */
  ollamaEnvironment?: { extensionOrigin: string; platform: OllamaPlatform };
}

/** Outside an extension there is no installation to name; tests pass their own. */
const DEFAULT_OLLAMA_ENVIRONMENT = {
  extensionOrigin: "moz-extension://this-extension",
  platform: "mac",
} as const;

const refuseOllamaAccess = (): Promise<boolean> => Promise.resolve(false);

/** Every answer the background may send this surface. */
const responseSchemas = {
  ...benchmarkResponseSchemas,
  ...diagnosticsResponseSchemas,
  ...inferenceResponseSchemas,
  ...modelInstallResponseSchemas,
  ...modelRegistryResponseSchemas,
  ...rpcResponseSchemas,
} as const;

/** Compute paths a user may pick between, in the order they are offered. */
const SELECTABLE_DEVICES: readonly InferenceDevice[] = ["wasm", "webgpu"];

/** One line that says how a model's checks went, before the detail of each. */
function ProbeSummary({ probes }: { probes: readonly ProbeResult[] }) {
  const failed = probes.filter(({ passed }) => !passed).length;

  return (
    <p data-testid="probe-summary" className="mt-2 flex items-center gap-2 text-sm font-medium">
      <StatusDot tone={failed === 0 ? "ok" : "bad"} />
      {failed === 0
        ? `All ${probes.length} checks passed`
        : `${failed} of ${probes.length} checks failed`}
    </p>
  );
}

/** Composition root of the options surface: model management and measurement. */
export function OptionsApp({
  client,
  profiles = BUNDLED_MODEL_PROFILES,
  requestOllamaAccess = refuseOllamaAccess,
  ollamaEnvironment = DEFAULT_OLLAMA_ENVIRONMENT,
}: OptionsAppProps) {
  const [state, dispatch] = useReducer(reduceOptionsState, INITIAL_OPTIONS_STATE);

  useEffect(() => {
    const unsubscribe = client.subscribe((message) => {
      let response;

      try {
        response = parseRpcMessage(message, responseSchemas);
      } catch (error) {
        // A message we cannot validate is not ours to render. Dropping it keeps
        // one malformed answer from taking the surface down.
        if (error instanceof RpcMessageError) {
          return;
        }

        throw error;
      }

      // `response` was validated against the response schemas above, and every
      // type those schemas admit is a member of `OptionsEvent` by construction.
      dispatch(response as OptionsEvent);

      if (
        response.type === "model.installed" ||
        response.type === "model.installFailed" ||
        response.type === "benchmark.measured" ||
        response.type === "benchmark.failed"
      ) {
        // Asked after anything that reaches the network, since that is when the
        // policy may have refused something.
        client.send(buildRpcMessage("diagnostics.read", {}));
      }

      if (response.type === "model.installed" || response.type === "model.activated") {
        // The list is now out of date, and what changed is exactly what the
        // user asked about, so refreshing it is the whole point.
        client.send(buildRpcMessage("model.list", {}));
      }
    });

    client.send(buildRpcMessage("inference.probe", {}));
    client.send(buildRpcMessage("model.list", {}));
    client.send(buildRpcMessage("diagnostics.read", {}));

    return unsubscribe;
  }, [client]);

  const requestInstall = (repository: string) => {
    dispatch({ type: "install-requested", repository });
    client.send(buildRpcMessage("model.install", { repository }));
  };

  const requestActivation = (ref: string) => {
    dispatch({ type: "activation-requested", ref });
    client.send(buildRpcMessage("model.activate", { ref, device: state.device }));
  };

  const requestBenchmark = (ref: string) => {
    dispatch({ type: "benchmark-requested", ref });
    client.send(buildRpcMessage("benchmark.run", { ref, device: state.device }));
  };

  const isDeviceUnavailable = (device: InferenceDevice) =>
    state.capabilities !== undefined && !state.capabilities.availableDevices.includes(device);

  return (
    <main
      data-testid="options-app"
      className="min-h-screen bg-white p-6 text-slate-900 dark:bg-slate-900 dark:text-slate-100"
    >
      <h1 className="text-lg font-semibold">Models</h1>

      <section className="mt-4">
        <h2 className="text-sm font-medium">This installation</h2>
        {state.capabilities === undefined ? (
          <p
            data-testid="capabilities-pending"
            className="text-sm text-slate-600 dark:text-slate-400"
          >
            Checking what this browser can run…
          </p>
        ) : (
          <p data-testid="capabilities" className="text-sm text-slate-600 dark:text-slate-400">
            {state.capabilities.availableDevices.join(", ")} ·{" "}
            {state.capabilities.threadCount === 1
              ? "single-threaded"
              : `${state.capabilities.threadCount} threads`}
            {state.capabilities.crossOriginIsolated ? null : " (no cross-origin isolation)"}
          </p>
        )}
      </section>

      <section className="mt-4">
        <h2 className="text-sm font-medium">Run on</h2>
        <div className="mt-1 flex gap-4 text-sm">
          {SELECTABLE_DEVICES.map((device) => (
            <label key={device} className="flex items-center gap-2">
              <input
                type="radio"
                name="device"
                value={device}
                data-testid={`device-${device}`}
                checked={state.device === device}
                disabled={state.isBusy || isDeviceUnavailable(device)}
                onChange={() => dispatch({ type: "device-selected", device })}
              />
              {device}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          The software path is what every supported platform has, so it is the one the performance
          budgets are judged against.
        </p>
      </section>

      {state.problem === undefined ? null : (
        <p data-testid="options-problem" className="mt-4 text-sm text-red-700 dark:text-red-400">
          {state.problem}
        </p>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-medium">Installed</h2>
        <div className="mt-2">
          <ModelList models={state.models} />
        </div>
        <ul className="mt-2 flex flex-col gap-2">
          {state.models.map((model) => (
            <li key={model.ref} className="flex items-center justify-between gap-4">
              <span className="text-xs text-slate-600 dark:text-slate-400">{model.repository}</span>
              <span className="flex gap-2">
                <Button
                  data-testid={`activate-${model.ref}`}
                  disabled={state.isBusy}
                  onClick={() => requestActivation(model.ref)}
                >
                  Check and activate
                </Button>
                {/* Throughput is an embedding figure; a generation model has its own measure. */}
                {model.family === "embedding" && (
                  <Button
                    data-testid={`measure-${model.ref}`}
                    disabled={state.isBusy}
                    onClick={() => requestBenchmark(model.ref)}
                  >
                    Measure
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {!state.isChecking && state.probes.length === 0 ? null : (
        <section className="mt-6">
          <h2 className="text-sm font-medium">Checks</h2>
          {state.isChecking ? (
            <p
              data-testid="probe-checking"
              className="mt-2 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
            >
              <StatusDot tone="busy" />
              Checking the model…
            </p>
          ) : (
            <ProbeSummary probes={state.probes} />
          )}
          <ul data-testid="probe-list" className="mt-2 flex flex-col gap-1 text-xs">
            {state.probes.map((probe) => (
              <li
                key={probe.name}
                className={`flex items-start gap-2 ${
                  probe.passed
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-red-700 dark:text-red-400"
                }`}
              >
                <span className="mt-1">
                  <StatusDot tone={probe.passed ? "ok" : "bad"} />
                </span>
                <span>
                  {probe.passed ? "Passed" : "Failed"} — {probe.name}: {probe.detail}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-medium">Throughput</h2>
        <div className="mt-2">
          <BenchmarkReport
            measurement={state.benchmark}
            threadCount={state.benchmark?.threadCount}
            isRunning={state.isBusy && state.benchmark === undefined}
          />
        </div>
      </section>

      <OllamaCard
        client={client}
        requestAccess={requestOllamaAccess}
        extensionOrigin={ollamaEnvironment.extensionOrigin}
        platform={ollamaEnvironment.platform}
      />

      <section className="mt-6">
        <h2 className="text-sm font-medium">Network policy</h2>
        <div className="mt-2">
          <PolicyReport permittedOrigins={state.permittedOrigins} blocked={state.blockedOrigins} />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium">Available to install</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {profiles.map((profile) => (
            <li key={profile.repository} className="flex items-center justify-between gap-4">
              <span className="text-sm">{profile.repository}</span>
              <Button
                data-testid={`install-${profile.repository}`}
                disabled={state.isBusy}
                onClick={() => requestInstall(profile.repository)}
              >
                Install
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <InstallProgress state={state.install} />
        </div>
      </section>
    </main>
  );
}
