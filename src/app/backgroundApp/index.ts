import type { IDBPDatabase } from "idb";

import { type InferenceWorker, loadModelIntoWorker } from "@/features/inference";
import { measureEmbeddingThroughput } from "@/features/inferenceBenchmark";
import { runEmbeddingConformance } from "@/features/modelConformance";
import { installModel } from "@/features/modelInstall";
import { countSessionNodes, readSessionGraph, readTabNode } from "@/features/researchGraph";
import { activateModel, listInstalledModels } from "@/features/modelRegistry";
import { buildGraphSnapshot, type GraphSnapshot } from "@/features/researchMap";
import {
  buildSessionSummary,
  endSessionForGroup,
  getActiveSession,
  reconcileActiveSession,
  renameSessionForGroup,
  startSession,
} from "@/features/researchSession";
import {
  closeTabNode,
  followTabMembership,
  reconcileSessionTabs,
  recordNavigation,
  recordTabFocus,
  updateTabTitle,
} from "@/features/tabCapture";
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
import { MODEL_STORE, type ResearchDatabaseSchema } from "@/shared/storage";
import type { ProbeResult } from "@/features/modelConformance";
import { requestSchemas } from "./schemas";
import type { BackgroundApp, BackgroundDependencies, Emit } from "./types";

export type {
  BackgroundApp,
  BackgroundDependencies,
  BackgroundPort,
  GroupEventDetails,
  TabChanges,
} from "./types";

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

/** The active session's graph as the map draws it. */
const readGraphSnapshot = async (
  openedDatabase: IDBPDatabase<ResearchDatabaseSchema>,
): Promise<GraphSnapshot> => {
  const session = await getActiveSession(openedDatabase);

  return buildGraphSnapshot(
    session,
    session === undefined
      ? { nodes: [], edges: [] }
      : await readSessionGraph(openedDatabase, session.id),
  );
};

export const createBackgroundApp = (dependencies: BackgroundDependencies): BackgroundApp => {
  let worker: InferenceWorker | undefined;
  let database: IDBPDatabase<ResearchDatabaseSchema> | undefined;
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

  const getDatabase = async (): Promise<IDBPDatabase<ResearchDatabaseSchema>> => {
    database ??= await dependencies.openDatabase();
    return database;
  };

  /**
   * Where the map pages listen. Each is the `emit` of one port, removed when
   * that port disconnects or can no longer be posted to.
   */
  const graphSubscribers = new Set<Emit>();
  /** Capture writes queued so far, counted so a waiting push knows what came after it. */
  let captureWriteCount = 0;
  /**
   * How many writes had been queued when the waiting push was queued, or
   * `undefined` while no push is waiting.
   */
  let graphPushQueuedAt: number | undefined;

  /** The tail of the capture queue; each capture event runs after the one before. */
  let captureQueue: Promise<void> = Promise.resolve();

  /**
   * Runs capture work in the order its events arrived.
   *
   * The browser reports a commit, the page's title and a focus change within
   * milliseconds, and each handler awaits the database; run side by side, a
   * title could be written before the node it belongs to exists. A failure is
   * reported and does not stop the work queued behind it.
   */
  const enqueueCapture = (
    work: (openedDatabase: IDBPDatabase<ResearchDatabaseSchema>) => Promise<unknown>,
  ) => {
    captureQueue = captureQueue
      .then(async () => {
        await work(await getDatabase());
      })
      .catch(dependencies.reportError);

    return captureQueue;
  };

  /** Queues a push behind every write queued so far. */
  const queueGraphPush = (): void => {
    graphPushQueuedAt = captureWriteCount;

    void enqueueCapture(async (openedDatabase) => {
      // Writes queued behind this push would be missed by reading now, so it
      // moves behind them instead: a burst of events ends in one push.
      if (captureWriteCount !== graphPushQueuedAt) {
        queueGraphPush();
        return;
      }

      // Cleared before reading, so a change made during the read is pushed too.
      graphPushQueuedAt = undefined;

      if (graphSubscribers.size === 0) {
        return;
      }

      const message = buildRpcMessage("graph.snapshot", await readGraphSnapshot(openedDatabase));

      for (const emit of graphSubscribers) {
        try {
          emit(message);
        } catch {
          // A port whose page has gone throws rather than delivering.
          graphSubscribers.delete(emit);
        }
      }
    });
  };

  /**
   * Sends every map page a fresh snapshot once the queued capture work is done.
   *
   * The push runs on the capture queue, so it reads the graph only after the
   * writes that called for it. While one push is waiting, a further change adds
   * nothing: that push will read it too.
   */
  const pushGraphSnapshot = (): void => {
    if (graphSubscribers.size > 0 && graphPushQueuedAt === undefined) {
      queueGraphPush();
    }
  };

  /** Runs capture work, then tells the map pages the graph may have changed. */
  const captureAndPush = (
    work: (openedDatabase: IDBPDatabase<ResearchDatabaseSchema>) => Promise<unknown>,
  ): Promise<void> => {
    captureWriteCount += 1;

    const captured = enqueueCapture(work);

    pushGraphSnapshot();

    return captured;
  };

  // The switch below is exhaustive over the parsed message union, and the
  // compiler knows it: adding a message type without a case makes this
  // function stop returning on every path, which is the error we want.
  const handleMessage = async (
    candidate: unknown,
    emit: Emit | undefined,
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

        case "tabGroup.create": {
          try {
            const { group } = await startSession({
              database: await getDatabase(),
              title: request.payload.title,
              api: dependencies.tabGroups,
            });

            // Not awaited into the answer: the browser may decline, or take its
            // time asking, and neither outcome changes that the session started.
            dependencies.persistStorage().catch(() => false);
            pushGraphSnapshot();

            return buildRpcMessage("tabGroup.created", group);
          } catch (error) {
            return buildRpcMessage("tabGroup.failed", { reason: getErrorMessage(error) });
          }
        }

        case "session.getActive": {
          const openedDatabase = await getDatabase();
          const session = await reconcileActiveSession({
            database: openedDatabase,
            getGroup: dependencies.tabGroups.getGroup,
          });

          return buildRpcMessage("session.active", {
            session:
              session === undefined
                ? null
                : buildSessionSummary(session, await countSessionNodes(openedDatabase, session.id)),
          });
        }

        case "graph.subscribe": {
          let snapshot: GraphSnapshot | undefined;

          // Read on the capture queue, and subscribed in the same step, so no
          // change can fall between the snapshot answered here and the pushes
          // that follow it.
          await enqueueCapture(async (openedDatabase) => {
            snapshot = await readGraphSnapshot(openedDatabase);

            // A one-shot message has nowhere to push to; it gets one snapshot.
            if (emit !== undefined) {
              graphSubscribers.add(emit);
            }
          });

          if (snapshot === undefined) {
            throw new Error("The session's graph could not be read.");
          }

          return buildRpcMessage("graph.snapshot", snapshot);
        }

        case "tab.focus": {
          const { tabId } = request.payload;
          const openedDatabase = await getDatabase();
          const session = await getActiveSession(openedDatabase);

          // Only a tab the map draws as open may be selected: the map is not a
          // channel for selecting arbitrary tabs, and a closed node has none.
          if (
            session === undefined ||
            (await readTabNode(openedDatabase, session.id, tabId)) === undefined
          ) {
            return buildRpcMessage("tab.focusRefused", {
              tabId,
              reason: "This page's tab is not open in the active session.",
            });
          }

          try {
            await dependencies.focusTab(tabId);
          } catch (error) {
            return buildRpcMessage("tab.focusRefused", { tabId, reason: getErrorMessage(error) });
          }

          return buildRpcMessage("tab.focused", { tabId });
        }

        case "map.open": {
          await dependencies.openMap();

          return buildRpcMessage("map.opened", {});
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
                emit?.(buildRpcMessage("model.installProgress", progress));
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
    // Nowhere to stream or push to on a one-shot message.
    handleMessage: (candidate) => handleMessage(candidate, undefined),
    attachPort: (port) => {
      // One per port, so the port's subscription can be found and dropped.
      const emit: Emit = (update) => {
        port.postMessage(update);
      };

      port.onMessage.addListener((message) => {
        void handleMessage(message, emit).then((response) => {
          try {
            port.postMessage(response);
          } catch {
            // The page went away before its answer; it has nothing to push to.
            graphSubscribers.delete(emit);
          }
        });
      });
      port.onDisconnect.addListener(() => {
        graphSubscribers.delete(emit);
      });
    },
    handleGroupUpdated: async (group) => {
      if (group.title !== undefined) {
        await renameSessionForGroup(await getDatabase(), group.id, group.title);
        pushGraphSnapshot();
      }
    },
    handleGroupRemoved: async (group, { isWindowClosing }) => {
      if (!isWindowClosing) {
        await endSessionForGroup(await getDatabase(), group.id);
        pushGraphSnapshot();
      }
    },
    reconcileSession: async () => {
      await reconcileActiveSession({
        database: await getDatabase(),
        getGroup: dependencies.tabGroups.getGroup,
      });
      await captureAndPush((openedDatabase) =>
        reconcileSessionTabs({ database: openedDatabase, api: dependencies.tabCapture }),
      );
    },
    handleNavigationCommitted: (navigation) =>
      captureAndPush((openedDatabase) =>
        recordNavigation({ database: openedDatabase, api: dependencies.tabCapture, navigation }),
      ),
    handleTabUpdated: (tab, changes) =>
      captureAndPush(async (openedDatabase) => {
        if (changes.groupId !== undefined) {
          await followTabMembership({ database: openedDatabase, tab });
        }

        if (changes.title !== undefined) {
          await updateTabTitle(openedDatabase, tab.id, changes.title);
        }
      }),
    handleTabActivated: (tabId) =>
      captureAndPush((openedDatabase) => recordTabFocus(openedDatabase, tabId)),
    handleTabRemoved: async (tabId, { isWindowClosing }) => {
      if (!isWindowClosing) {
        await captureAndPush((openedDatabase) => closeTabNode(openedDatabase, tabId));
      }
    },
    shutdown: () => {
      discardWorker();
      database = undefined;
    },
  };
};
