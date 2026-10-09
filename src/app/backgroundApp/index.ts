import type { IDBPDatabase } from "idb";

import {
  type InferenceWorker,
  inferenceRequestSchemas,
  loadModelIntoWorker,
} from "@/features/inference";
import { benchmarkRequestSchemas, measureEmbeddingThroughput } from "@/features/inferenceBenchmark";
import { diagnosticsRequestSchemas } from "@/features/diagnostics";
import { runEmbeddingConformance } from "@/features/modelConformance";
import { installModel, modelInstallRequestSchemas } from "@/features/modelInstall";
import {
  activateModel,
  listInstalledModels,
  modelRegistryRequestSchemas,
} from "@/features/modelRegistry";
import { BUNDLED_MODEL_PROFILES } from "@/shared/config/modelProfiles";
import { MODEL_HOST_ORIGINS } from "@/shared/huggingFace";
import type { InferenceDevice } from "@/shared/modelManifest";
import type { PolicyViolationLog } from "@/shared/collectPolicyViolations";
import { buildRpcMessage, parseRpcMessage, type RpcMessage } from "@/shared/rpc";
import { MODEL_STORE, type ModelDatabaseSchema } from "@/shared/storage";
import type { ProbeResult } from "@/features/modelConformance";

/**
 * Composition root for the background context.
 *
 * The background is the extension's only coordinator: it owns the inference
 * worker and is the only context that writes local storage. Surfaces send it
 * intents and render what comes back.
 *
 * Everything the browser provides arrives as a dependency, so the whole
 * dispatch path is exercised in unit tests without an extension runtime. The
 * entrypoint does nothing but supply the real implementations.
 */
export interface BackgroundDependencies {
  /** Spawns the inference worker. Called at most once, on first need. */
  createInferenceWorker: () => InferenceWorker;
  /** Opens the add-on's database. Called at most once, on first need. */
  openDatabase: () => Promise<IDBPDatabase<ModelDatabaseSchema>>;
  fetchResource: typeof fetch;
  /**
   * What the content security policy has refused.
   *
   * Attached in this context because violations are reported where they
   * occur, and this is the context that fetches model files — a listener on a
   * surface would never see them.
   */
  policyViolations: PolicyViolationLog;
}

/**
 * The part of a runtime port this app uses.
 *
 * Declared structurally so the relay is exercised without an extension
 * runtime; the real port satisfies it.
 */
export interface BackgroundPort {
  postMessage: (message: unknown) => void;
  onMessage: { addListener: (listener: (message: unknown) => void) => void };
}

/** Sends a message that is not the answer to a request, such as progress. */
type Emit = (message: RpcMessage<string, unknown>) => void;

export interface BackgroundApp {
  /**
   * Validates an untrusted message from a surface and answers it.
   *
   * One-shot messaging carries no intermediate updates, so progress a handler
   * would stream is dropped. A surface that wants it connects a port.
   */
  handleMessage: (candidate: unknown) => Promise<RpcMessage<string, unknown>>;
  /**
   * Serves a surface's long-lived connection, answering on the same port.
   *
   * A port rather than one-shot messages because progress has to stream while
   * work is still running — an install reports bytes as they arrive — and
   * because holding one open is what keeps the event page from unloading
   * mid-job.
   */
  attachPort: (port: BackgroundPort) => void;
  /** Releases the worker, if one was ever started. */
  shutdown: () => void;
}

/** Every message a surface may send, contributed by the features that own them. */
const requestSchemas = {
  ...benchmarkRequestSchemas,
  ...diagnosticsRequestSchemas,
  ...inferenceRequestSchemas,
  ...modelInstallRequestSchemas,
  ...modelRegistryRequestSchemas,
} as const;

/** Answers a surface with why its request could not be satisfied. */
const fail = (reason: string): RpcMessage<string, unknown> => {
  return buildRpcMessage("inference.failed", { reason });
};

export const createBackgroundApp = (dependencies: BackgroundDependencies): BackgroundApp => {
  let worker: InferenceWorker | undefined;
  let database: IDBPDatabase<ModelDatabaseSchema> | undefined;
  /** Compute path the live worker has already initialised its runtime for. */
  let workerDevice: InferenceDevice | undefined;

  /**
   * Started on first need rather than at startup: an event page that spawns a
   * worker eagerly pays for it on every wake, including wakes that have nothing
   * to infer.
   */
  const getWorker = (): InferenceWorker => {
    worker ??= dependencies.createInferenceWorker();
    return worker;
  };

  /**
   * Returns a worker whose runtime can serve this compute path.
   *
   * The model runtime memoises its backend initialisation per realm: once a
   * worker has tried to start on one device, that attempt is the one it keeps,
   * successful or not. So a device change — and a failed start on any device —
   * needs a new worker rather than another request to the old one, which would
   * keep failing the same way and look like a defect in the model.
   */
  const getWorkerForDevice = (device: InferenceDevice): InferenceWorker => {
    if (worker !== undefined && workerDevice !== undefined && workerDevice !== device) {
      worker.terminate();
      worker = undefined;
    }

    workerDevice = device;

    return getWorker();
  };

  /** Discards the worker, so the next attempt starts from a clean runtime. */
  const discardWorker = (): void => {
    worker?.terminate();
    worker = undefined;
    workerDevice = undefined;
  };

  const getDatabase = async (): Promise<IDBPDatabase<ModelDatabaseSchema>> => {
    database ??= await dependencies.openDatabase();
    return database;
  };

  // The switch below is exhaustive over the parsed message union, and the
  // compiler knows it: adding a message type without a case makes this
  // function stop returning on every path, which is the error we want.
  const handleMessage = async (
    candidate: unknown,
    emit: Emit,
  ): Promise<RpcMessage<string, unknown>> => {
    let request;

    try {
      request = parseRpcMessage(candidate, requestSchemas);
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }

    try {
      switch (request.type) {
        case "inference.probe": {
          // Already validated by the worker channel, which refuses any
          // response the protocol does not describe.
          const response = await getWorker().request("worker.ping", {});

          if (response.type !== "worker.pong") {
            return fail(`Worker answered a probe with "${response.type}"`);
          }

          return buildRpcMessage("inference.capabilities", response.payload);
        }

        case "model.list": {
          return buildRpcMessage("model.listed", {
            models: await listInstalledModels(await getDatabase()),
          });
        }

        case "diagnostics.read": {
          return buildRpcMessage("diagnostics.report", {
            blocked: dependencies.policyViolations.read(),
            permittedOrigins: [...MODEL_HOST_ORIGINS],
          });
        }

        case "benchmark.run": {
          const device = request.payload.device ?? "wasm";
          const { ref } = request.payload;

          try {
            const openedDatabase = await getDatabase();
            const model = await openedDatabase.get(MODEL_STORE, ref);

            if (model === undefined) {
              throw new Error(`No model is installed under "${ref}".`);
            }

            const activeWorker = getWorkerForDevice(device);
            const session = await loadModelIntoWorker({
              model,
              database: openedDatabase,
              worker: activeWorker,
              device,
            });
            const measurement = await measureEmbeddingThroughput({
              session,
              modelRef: ref,
              database: openedDatabase,
            });

            // Asked again rather than remembered: the figure is only
            // interpretable beside the thread count that produced it.
            const probe = await activeWorker.request("worker.ping", {});
            const threadCount = probe.type === "worker.pong" ? probe.payload.threadCount : 1;

            return buildRpcMessage("benchmark.measured", { ref, ...measurement, threadCount });
          } catch (error) {
            discardWorker();

            return buildRpcMessage("benchmark.failed", {
              ref,
              reason: error instanceof Error ? error.message : String(error),
            });
          }
        }

        case "model.activate": {
          // Named rather than defaulted: the compute path decides the numbers
          // this change exists to produce, so it is never chosen implicitly.
          const device = request.payload.device ?? "wasm";
          const { ref } = request.payload;

          try {
            let probes: ProbeResult[] = [];

            const recorded = await activateModel({
              ref,
              database: await getDatabase(),
              runConformance: async (model) => {
                if (model.manifest.contract.family !== "embedding") {
                  return {
                    passed: false,
                    probes: [],
                    reason: `No conformance suite exists yet for a ${model.manifest.contract.family} model.`,
                  };
                }

                const session = await loadModelIntoWorker({
                  model,
                  database: await getDatabase(),
                  worker: getWorkerForDevice(device),
                  device,
                });
                const outcome = await runEmbeddingConformance(
                  model.manifest.contract,
                  session.embed,
                );

                probes = outcome.probes;

                return outcome;
              },
            });

            return buildRpcMessage("model.activated", {
              ref: recorded.ref,
              active: recorded.active,
              conformance: recorded.conformance,
              reason: recorded.conformanceReason,
              device,
              probes,
            });
          } catch (error) {
            discardWorker();

            return buildRpcMessage("model.activationFailed", {
              ref,
              reason: error instanceof Error ? error.message : String(error),
            });
          }
        }

        case "model.install": {
          const { repository } = request.payload;
          const profile = BUNDLED_MODEL_PROFILES.find(
            (candidateProfile) => candidateProfile.repository === repository,
          );

          if (profile === undefined) {
            return buildRpcMessage("model.installFailed", {
              repository,
              reason: `No bundled profile for "${repository}".`,
            });
          }

          try {
            const model = await installModel({
              profile,
              database: await getDatabase(),
              fetchResource: dependencies.fetchResource,
              onProgress: (progress) => {
                emit(buildRpcMessage("model.installProgress", progress));
              },
            });

            return buildRpcMessage("model.installed", {
              ref: model.ref,
              diskBytes: model.diskBytes,
              conformance: model.conformance,
            });
          } catch (error) {
            return buildRpcMessage("model.installFailed", {
              repository,
              reason: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  };

  return {
    handleMessage: (candidate) =>
      handleMessage(candidate, () => {
        // Nowhere to stream to on a one-shot message.
      }),
    attachPort: (port) => {
      port.onMessage.addListener((message) => {
        void handleMessage(message, (update) => {
          port.postMessage(update);
        }).then((response) => {
          port.postMessage(response);
        });
      });
    },
    shutdown: () => {
      discardWorker();
      database = undefined;
    },
  };
};
