import type { IDBPDatabase } from "idb";

import { type InferenceWorker, loadModelIntoWorker } from "@/features/inference";
import { measureEmbeddingThroughput } from "@/features/inferenceBenchmark";
import { runEmbeddingConformance } from "@/features/modelConformance";
import { installModel } from "@/features/modelInstall";
import { activateModel, listInstalledModels } from "@/features/modelRegistry";
import { BUNDLED_MODEL_PROFILES } from "@/shared/config";
import { MODEL_HOST_ORIGINS } from "@/shared/huggingFace";
import type { InferenceDevice } from "@/shared/modelManifest";
import { getErrorMessage } from "@/shared/getErrorMessage";
import {
  buildRpcMessage,
  parseRpcMessage,
  readMessageField,
  type RpcMessage,
  RpcMessageError,
} from "@/shared/rpc";
import { MODEL_STORE, type ModelDatabaseSchema } from "@/shared/storage";
import type { ProbeResult } from "@/features/modelConformance";
import { requestSchemas } from "./schemas";
import type { BackgroundApp, BackgroundDependencies, Emit } from "./types";

export type { BackgroundApp, BackgroundDependencies, BackgroundPort } from "./types";

/** Answers a request that could not be trusted, saying which check it failed. */
const refuse = (candidate: unknown, error: unknown): RpcMessage<string, unknown> => {
  if (error instanceof RpcMessageError) {
    return buildRpcMessage("rpc.refused", { rejection: error.rejection, reason: error.message });
  }

  // The parser raises nothing else, so this is a bug in it rather than a bad
  // message; it is still answered, or the surface would wait for nothing.
  return buildRpcMessage("rpc.failed", {
    requestType: readMessageField(candidate, "type") ?? "unknown",
    reason: getErrorMessage(error),
  });
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
      return refuse(candidate, error);
    }

    try {
      switch (request.type) {
        case "inference.probe": {
          try {
            // Already validated by the worker channel, which refuses any
            // response the protocol does not describe.
            const response = await getWorker().request("worker.ping", {});

            if (response.type !== "worker.pong") {
              throw new Error(`The worker answered a probe with "${response.type}".`);
            }

            return buildRpcMessage("inference.capabilities", response.payload);
          } catch (error) {
            return buildRpcMessage("inference.failed", { reason: getErrorMessage(error) });
          }
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
              reason: getErrorMessage(error),
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
              reason: getErrorMessage(error),
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
              reason: getErrorMessage(error),
            });
          }
        }
      }
    } catch (error) {
      // Each case answers for its own failures; reaching here is a bug, and is
      // still answered so the surface is never left waiting.
      return buildRpcMessage("rpc.failed", {
        requestType: request.type,
        reason: getErrorMessage(error),
      });
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
