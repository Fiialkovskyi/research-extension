import type { IDBPDatabase } from "idb";
import * as v from "valibot";

import {
  type InferenceWorker,
  loadModelIntoWorker,
  type WorkerModelSession,
} from "@/features/inference";
import {
  buildOllamaManifest,
  createOllamaEmbedder,
  createOllamaGenerator,
  findOllamaProfile,
  isLocalAiPaused,
  listOllamaModelEntries,
  matchesOllamaName,
  pullOllamaModel,
  readOllamaStatus,
  requeuePausedJobs,
} from "@/features/ollama";
import {
  EXTRACTION_PROGRESS_INTERVAL_MS,
  measureEmbeddingThroughput,
  measureExtractionTime,
} from "@/features/inferenceBenchmark";
import { runEmbeddingConformance, runGenerationConformance } from "@/features/modelConformance";
import { installModel } from "@/features/modelInstall";
import {
  injectPageObserver,
  injectSessionTabs,
  pageContentRequestSchemas,
  readSignalTarget,
  recordSignalBatch,
} from "@/features/pageSignals";
import {
  readSnapshotCandidate,
  recordSnapshot,
  sealPlaintextSnapshots,
} from "@/features/pageSnapshots";
import {
  readClustering,
  reclusterActiveSession,
  RECLUSTER_DELAY_MS,
} from "@/features/researchClusters";
import {
  deleteNode,
  deleteSession,
  readRecordedSession,
  readRecordedText,
} from "@/features/recordedData";
import {
  countSessionNodes,
  readSessionGraph,
  readSessionRoot,
  readTabNode,
} from "@/features/researchGraph";
import {
  declineReattach,
  findReattachCandidate,
  reattachSession,
  suggestReattach,
  closeTabsKeepingWindow,
  listSavedSessions,
  resumeSession,
  SAVE_FLUSH_TIMEOUT_MS,
  saveActiveSession,
} from "@/features/researchLibrary";
import {
  EMBED_SNAPSHOT_JOB,
  type EmbeddingSession,
  enqueueSnapshotEmbeddings,
  runEmbeddingJob,
} from "@/features/snapshotEmbeddings";
import {
  checkpointJob,
  enqueueJob,
  getNextWakeTime,
  holdBackgroundAlive,
  JOB_WAKE_ALARM,
  JOB_WAKE_DELAY_MS,
  type JobRunner,
  readPendingJobs,
  requeueRunningJobs,
  runNextJob,
} from "@/features/jobQueue";
import {
  CLUSTER_SUMMARY_PROMPT,
  enqueueClusterSummaries,
  readSummariesView,
  requestClusterSummary,
  runClusterSummaryJob,
  SUMMARIZE_CLUSTER_JOB,
} from "@/features/clusterSummaries";
import { readComparisonTable, saveTableColumns } from "@/features/comparisonTable";
import { openGapSearch, readResearchGaps } from "@/features/researchGaps";
import { rejectFacts, restoreRejections } from "@/features/factRejections";
import {
  enqueueOpenQuestions,
  getQuestionsProducer,
  readOpenQuestions,
  requestOpenQuestions,
  runOpenQuestionsJob,
  SUGGEST_QUESTIONS_JOB,
} from "@/features/openQuestions";
import {
  enqueueEntityResolutions,
  RESOLVE_ENTITIES_JOB,
  runEntityResolutionJob,
  separateEntity,
} from "@/features/entityResolution";
import {
  enqueueFactExtractions,
  EXTRACT_FACTS_JOB,
  getFactProducerVersion,
  runFactExtractionJob,
} from "@/features/factExtraction";
import {
  HOLD_PING_INTERVAL_MS,
  HOLD_PORT_NAME,
  LIFETIME_PROBE_JOB,
  type LifetimeStrategy,
  readProbeOutcome,
  runLifetimeProbe,
} from "@/features/diagnostics";
import { activateModel, getActiveModel, listInstalledModels } from "@/features/modelRegistry";
import { buildGraphSnapshot, type GraphSnapshot } from "@/features/researchMap";
import {
  buildSessionSummary,
  closeSessionForGroup,
  getActiveSession,
  getLiveSession,
  reconcileActiveSession,
  renameSessionForGroup,
  reopenSessionForGroup,
  restoreSessionTab,
  SESSION_TAB_VALUE_KEY,
  startSession,
  trackSessionTabMembership,
} from "@/features/researchSession";
import {
  closeTabNode,
  followTabMembership,
  linkRefinement,
  reconcileSessionTabs,
  recordNavigation,
  recordTabFocus,
  trackActiveDwell,
  updateTabTitle,
} from "@/features/tabCapture";
import {
  BUNDLED_MODEL_PROFILES,
  ENGAGEMENT_RULES,
  LOCAL_INFERENCE_ORIGINS,
  OLLAMA_ORIGIN,
} from "@/shared/config";
import { MODEL_HOST_ORIGINS } from "@/shared/huggingFace";
import { getModelRef, type InferenceDevice } from "@/shared/modelManifest";
import { getErrorMessage } from "@/shared/getErrorMessage";
import {
  buildRpcMessage,
  parseRpcMessage,
  readMessageField,
  type RpcMessage,
  RpcMessageError,
} from "@/shared/rpc";
import {
  HEARTBEAT_STORE,
  JOB_STORE,
  MODEL_STORE,
  NODE_STORE,
  type ResearchDatabaseSchema,
  type StoredJob,
  type StoredModel,
} from "@/shared/storage";
import type { ProbeResult } from "@/features/modelConformance";
import { requestSchemas } from "./schemas";
import type { PageSender } from "@/features/pageSignals";
import type {
  BackgroundApp,
  BackgroundDependencies,
  BackgroundPort,
  Emit,
  IdleState,
} from "./types";

export type {
  BackgroundApp,
  BackgroundDependencies,
  BackgroundPort,
  GroupEventDetails,
  IdleState,
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

/** Whether a job was asked for by the user, which lets it run while they are active. */
const isRequested = (job: StoredJob): boolean => {
  const payload = v.safeParse(requestedPayloadSchema, job.payload);

  return payload.success && payload.output.requestedAt !== undefined;
};

/** The part of a generation job's payload that says the user asked for it. */
const requestedPayloadSchema = v.object({ requestedAt: v.optional(v.number()) });

/** Jobs that run text generation, and so only while the user is away or asked (REQ-MOD-008). */
const GENERATION_JOBS: ReadonlySet<string> = new Set([
  EXTRACT_FACTS_JOB,
  SUMMARIZE_CLUSTER_JOB,
  SUGGEST_QUESTIONS_JOB,
]);

/** The models registered from the local Ollama server. */
const listInstalledOllamaModels = async (
  openedDatabase: IDBPDatabase<ResearchDatabaseSchema>,
): Promise<StoredModel[]> =>
  (await openedDatabase.getAll(MODEL_STORE)).filter(
    (model) => model.manifest.reference.hub === "ollama",
  );

/** The active session's graph as the map draws it. */
const readGraphSnapshot = async (
  openedDatabase: IDBPDatabase<ResearchDatabaseSchema>,
): Promise<GraphSnapshot> => {
  const session = await getActiveSession(openedDatabase);

  if (session === undefined) {
    return buildGraphSnapshot(undefined, { nodes: [], edges: [] });
  }

  const [graph, clustering] = await Promise.all([
    readSessionGraph(openedDatabase, session.id),
    readClustering(openedDatabase, session.id),
  ]);

  return buildGraphSnapshot(session, graph, clustering?.clusters);
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
  const ollamaOrigin = dependencies.ollamaOrigin ?? OLLAMA_ORIGIN;

  /**
   * Loads a model for use, wherever it runs: an Ollama model through the local
   * server, any other in the worker on the given device.
   */
  const loadModelSession = async (
    model: StoredModel,
    device: InferenceDevice,
  ): Promise<WorkerModelSession> => {
    if (model.manifest.reference.hub === "ollama") {
      const embedder = createOllamaEmbedder(
        dependencies.fetchResource,
        ollamaOrigin,
        model.manifest,
      );

      return {
        device: "local-server",
        ...(model.manifest.contract.family === "embedding"
          ? { dimensions: model.manifest.contract.dimensions }
          : {}),
        loadDurationMs: 0,
        embed: embedder.embed,
      };
    }

    return loadModelIntoWorker({
      model,
      database: await getDatabase(),
      worker: getWorkerForDevice(device),
      device,
    });
  };

  /** Embedding models loaded in the worker for jobs, by model ref. */
  const embeddingSessions = new Map<string, Promise<EmbeddingSession>>();

  const discardWorker = (): void => {
    worker?.terminate();
    worker = undefined;
    workerDevice = undefined;
    // Their models lived in that worker.
    embeddingSessions.clear();
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

  /** The tail of the work queue. Never rejects, so one failure does not stall the rest. */
  let workQueue: Promise<unknown> = Promise.resolve();

  /**
   * Runs session and capture work one piece at a time, in the order its events
   * arrived.
   *
   * Browser events come in bursts, and each handler reads the database, may ask
   * the browser, then writes. The browser reports a commit, the page's title and
   * a focus change within milliseconds; run side by side, a title could be
   * written before the node it belongs to exists. A restored group announces
   * itself, then each of its tabs; run side by side, two restored tabs of a gone
   * group would both find no group and create two. One queue for both kinds
   * also keeps a page's capture behind the session change that admitted it.
   */
  const serializeWork = <T>(work: () => Promise<T>): Promise<T> => {
    const result = workQueue.then(work);

    workQueue = result.catch(() => undefined);

    return result;
  };

  /**
   * Runs capture work on the queue. A failure is reported rather than
   * returned: nobody waits on a capture event.
   */
  const enqueueCapture = (
    work: (openedDatabase: IDBPDatabase<ResearchDatabaseSchema>) => Promise<unknown>,
  ): Promise<void> =>
    serializeWork(async () => {
      await work(await getDatabase());
    }).catch(dependencies.reportError);

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

  const setTimer =
    dependencies.setTimer ??
    ((callback: () => void, delayMs: number) => setTimeout(callback, delayMs));
  const clearTimer =
    dependencies.clearTimer ??
    ((handle: unknown) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    });
  let reclusterTimer: unknown;

  /** Clusters the active session again, then pushes the graph with its clusters. */
  const recluster = async (): Promise<void> => {
    await enqueueCapture(async (openedDatabase) => {
      await reclusterActiveSession(openedDatabase, getNow());
      // Clusters may have gained or lost pages, and with them facts.
      await enqueueClusterSummaries(openedDatabase, getNow());
      await enqueueOpenQuestions(openedDatabase, getNow());
    });
    pushGraphSnapshot();
    // A summary just queued must not wait for the next wake-up to be claimed.
    void runJobs();
  };

  /**
   * (Re)arms the recompute of clusters for when the graph has been quiet for
   * the debounce delay (REQ-CLU-003): a burst of navigation clusters once.
   * Kept in memory: if the event page unloads first, the next capture event
   * arms it again, and start-up reconciliation reclusters regardless.
   */
  const scheduleRecluster = (): void => {
    if (reclusterTimer !== undefined) {
      clearTimer(reclusterTimer);
    }

    reclusterTimer = setTimer(() => {
      reclusterTimer = undefined;
      void recluster();
    }, RECLUSTER_DELAY_MS);
  };

  /** Runs capture work, then tells the map pages the graph may have changed. */
  const captureAndPush = (
    work: (openedDatabase: IDBPDatabase<ResearchDatabaseSchema>) => Promise<unknown>,
  ): Promise<void> => {
    captureWriteCount += 1;

    const captured = enqueueCapture(work);

    pushGraphSnapshot();
    scheduleRecluster();

    return captured;
  };

  const getNow = dependencies.now ?? Date.now;

  /**
   * Starts observing a tab's page. Not awaited: an injection waits for the page
   * to finish loading, and capture must not wait with it.
   */
  const observeTab = (tabId: number): void => {
    void injectPageObserver(dependencies.pageSignals, tabId);
  };

  /** Starts observing a tab's page if capture follows the tab. */
  const observeIfCaptured = async (
    openedDatabase: IDBPDatabase<ResearchDatabaseSchema>,
    tabId: number,
  ): Promise<void> => {
    const session = await getActiveSession(openedDatabase);

    if (session !== undefined && (await readTabNode(openedDatabase, session.id, tabId))) {
      observeTab(tabId);
    }
  };

  /**
   * Asks a page for its text when its node has just become deep read. The text
   * comes back as a message of its own, on this same queue, so it is not
   * awaited here.
   */
  const requestSnapshotIfDue = async (
    openedDatabase: IDBPDatabase<ResearchDatabaseSchema>,
    nodeId: string,
  ): Promise<void> => {
    const candidate = await readSnapshotCandidate(openedDatabase, nodeId);

    if (candidate !== undefined) {
      dependencies.pageSignals.requestPageText(candidate.tabId).catch(() => undefined);
    }
  };

  /**
   * Brings reading time up to date and follows focus to the tab the user is
   * reading now, asked of the browser rather than remembered.
   */
  const followFocus = async (
    openedDatabase: IDBPDatabase<ResearchDatabaseSchema>,
    { now = getNow(), discardOpen = false }: { now?: number; discardOpen?: boolean } = {},
  ): Promise<void> => {
    const { dwelledNodeId } = await trackActiveDwell({
      database: openedDatabase,
      focusedTabId: await dependencies.readFocusedTab(),
      now,
      discardOpen,
    });

    if (dwelledNodeId !== undefined) {
      await requestSnapshotIfDue(openedDatabase, dwelledNodeId);
    }
  };

  /**
   * Brings the session's captured tabs in line with the tabs of its group, and
   * observes their pages. Reading time left running by an earlier run is
   * dropped: how long the browser was away says nothing about reading.
   */
  const reconcileTabs = (): Promise<void> =>
    captureAndPush(async (openedDatabase) => {
      await reconcileSessionTabs({ database: openedDatabase, api: dependencies.tabCapture });
      void injectSessionTabs(openedDatabase, dependencies.pageSignals);
      await followFocus(openedDatabase, { discardOpen: true });
    });

  /**
   * Loads the embedding model for jobs once, on the software path the
   * add-on's minimum Firefox has, and keeps it while the worker lives.
   */
  const loadEmbeddingSession =
    dependencies.loadEmbeddingSession ??
    ((model: StoredModel): Promise<EmbeddingSession> => {
      const cached = embeddingSessions.get(model.ref);

      if (cached !== undefined) {
        return cached;
      }

      const loading = loadModelSession(model, "wasm");

      embeddingSessions.set(model.ref, loading);
      loading.catch(() => {
        embeddingSessions.delete(model.ref);
      });

      return loading;
    });

  /** Identifies this load of the background page, which a probe's beats record. */
  const pageLoadId = crypto.randomUUID();
  /** The hold page's ports, which the `hostPage` strategy posts to. */
  const holdPorts = new Set<BackgroundPort>();

  /**
   * Keeps the background loaded while a job runs, with no extension page open
   * to keep it company. Spike M0-1 found an API call every few seconds is
   * what Firefox counts as activity; a pending `fetch` is not.
   */
  const holdForJob = (): (() => void) => holdBackgroundAlive(dependencies.backgroundLifetime.touch);

  /**
   * Starts a probe strategy's keep-alive (spike M0-1) and returns its release;
   * `none` and `wakeAndResume` have none, and `jobRunner` is the hold every
   * job runs under.
   */
  const holdFor = (strategy: LifetimeStrategy): (() => void) | undefined => {
    const { backgroundLifetime } = dependencies;

    switch (strategy) {
      case "none":
      case "wakeAndResume": {
        return undefined;
      }
      case "apiActivity": {
        return holdBackgroundAlive(backgroundLifetime.touch);
      }
      case "jobRunner": {
        return holdForJob();
      }
      case "hostPage": {
        const opened = backgroundLifetime.openHoldPage();
        const release = holdBackgroundAlive(() => {
          for (const port of holdPorts) {
            port.postMessage({ type: "hold.ping" });
          }

          return Promise.resolve();
        }, HOLD_PING_INTERVAL_MS);

        return () => {
          release();
          void opened
            .then((tabId) => backgroundLifetime.closeTab(tabId))
            .catch(dependencies.reportError);
        };
      }
    }
  };

  /** Runs a job type's work under {@link holdForJob}. */
  const runHeld =
    (run: JobRunner): JobRunner =>
    async (job) => {
      const release = holdForJob();

      try {
        return await run(job);
      } finally {
        release();
      }
    };

  /**
   * Whether the user is away: the browser reports them idle or locked. Text
   * generation runs only then, or when asked for (REQ-MOD-008).
   */
  const isUserAway = async (): Promise<boolean> =>
    (await dependencies.readIdleState()) !== "active";

  /**
   * Whether a fact-extraction job may take its next chunk now: the user is
   * away, or asked for it. Read afresh from the queue, so a request made while
   * it runs counts at once.
   */
  const mayExtractNow = async (jobId: string): Promise<boolean> => {
    const job = await (await getDatabase()).get(JOB_STORE, jobId);

    return (job !== undefined && isRequested(job)) || (await isUserAway());
  };

  /**
   * What each job type does, by type. Every job runs held, except the probe,
   * which holds the background by its own strategy — that is what it measures.
   */
  const jobRunners: Record<string, JobRunner> = {
    [EMBED_SNAPSHOT_JOB]: runHeld(async (job) => {
      await runEmbeddingJob({
        database: await getDatabase(),
        job,
        loadSession: loadEmbeddingSession,
      });
    }),
    [EXTRACT_FACTS_JOB]: runHeld(async (job) => {
      const openedDatabase = await getDatabase();
      const model = await getActiveModel(openedDatabase, "text-generation");

      // Queued for a model that is no longer the active one: the model now
      // active has jobs of its own, so this one has nothing left to do.
      if (
        model === undefined ||
        model.manifest.reference.hub !== "ollama" ||
        getFactProducerVersion(model.ref) !== job.producerVersion
      ) {
        return undefined;
      }

      const generator = createOllamaGenerator(
        dependencies.fetchResource,
        ollamaOrigin,
        model.manifest,
      );

      const outcome = await runFactExtractionJob({
        database: openedDatabase,
        job,
        modelRef: model.ref,
        generate: generator.generate,
        mayContinue: () => mayExtractNow(job.id),
        now: getNow,
      });

      // The page's facts are all in: its entities can be resolved next.
      if (outcome !== "deferred") {
        await enqueueEntityResolutions(openedDatabase);
      }

      return outcome;
    }),
    [RESOLVE_ENTITIES_JOB]: runHeld(async (job) => {
      const openedDatabase = await getDatabase();
      const embeddingModel = await getActiveModel(openedDatabase, "embedding");
      const session =
        embeddingModel === undefined ? undefined : await loadEmbeddingSession(embeddingModel);

      await runEntityResolutionJob({
        database: openedDatabase,
        job,
        ...(session === undefined
          ? {}
          : { embed: (texts: readonly string[]) => session.embed(texts, "document") }),
        now: getNow,
      });
      // The page's facts are settled: its cluster's summary is due in a while,
      // and the session's open questions.
      await enqueueClusterSummaries(openedDatabase, getNow());
      await enqueueOpenQuestions(openedDatabase, getNow());
    }),
    [SUMMARIZE_CLUSTER_JOB]: runHeld(async (job) => {
      const openedDatabase = await getDatabase();
      const model = await getActiveModel(openedDatabase, "text-generation");

      // Queued for a model no longer active: the active one has jobs of its own.
      if (
        model === undefined ||
        model.manifest.reference.hub !== "ollama" ||
        job.producerVersion !==
          `${CLUSTER_SUMMARY_PROMPT.id}@${CLUSTER_SUMMARY_PROMPT.version}|${model.ref}`
      ) {
        return;
      }

      const generator = createOllamaGenerator(
        dependencies.fetchResource,
        ollamaOrigin,
        model.manifest,
      );

      await runClusterSummaryJob({
        database: openedDatabase,
        job,
        modelRef: model.ref,
        generate: generator.generate,
        now: getNow,
      });
    }),
    [SUGGEST_QUESTIONS_JOB]: runHeld(async (job) => {
      const openedDatabase = await getDatabase();
      const model = await getActiveModel(openedDatabase, "text-generation");

      // Queued for a model no longer active: the active one has jobs of its own.
      if (
        model === undefined ||
        model.manifest.reference.hub !== "ollama" ||
        job.producerVersion !== getQuestionsProducer(model.ref)
      ) {
        return;
      }

      await runOpenQuestionsJob({
        database: openedDatabase,
        job,
        modelRef: model.ref,
        generate: createOllamaGenerator(dependencies.fetchResource, ollamaOrigin, model.manifest)
          .generate,
        now: getNow,
      });
    }),
    [LIFETIME_PROBE_JOB]: async (job) => {
      const openedDatabase = await getDatabase();

      await runLifetimeProbe({
        job,
        pageLoadId,
        now: getNow,
        sleep: (ms) =>
          new Promise((resolve) => {
            setTimer(resolve, ms);
          }),
        writeHeartbeat: async (heartbeat) => {
          await openedDatabase.put(HEARTBEAT_STORE, heartbeat);
        },
        saveCheckpoint: (checkpoint) => checkpointJob(openedDatabase, job.id, checkpoint),
        holdFor,
      });
    },
  };

  /**
   * Sets the job wake-up for what is pending, or clears it. A failure is
   * reported, not thrown: the jobs still run while the page is loaded.
   */
  const scheduleJobWake = async (at?: number): Promise<void> => {
    try {
      const wakeAt = at ?? getNextWakeTime(await readPendingJobs(await getDatabase()), getNow());

      await dependencies.backgroundLifetime.scheduleWake(wakeAt);
    } catch (error) {
      dependencies.reportError(error);
    }
  };

  let isRunningJobs = false;
  let isJobRunRequested = false;
  let hasRequeuedJobs = false;

  /**
   * Runs due jobs one at a time until none is left (REQ-MOD-008: one embedding
   * batch at a time). Single-flight: a request while running makes the running
   * loop look again rather than starting a second. Off the capture queue —
   * embedding takes seconds, and capture must not wait for it.
   *
   * The first run after the page loads hands back jobs a previous load left
   * running: nothing of this load can be running them yet. While jobs run, a
   * wake-up is set a minute ahead, so an unload mid-job is recovered; once the
   * loop ends, it is set for what is still pending, or cleared.
   */
  const runJobs = async (): Promise<void> => {
    if (isRunningJobs) {
      isJobRunRequested = true;
      return;
    }

    isRunningJobs = true;

    let hasRunAny = false;

    try {
      if (!hasRequeuedJobs) {
        hasRequeuedJobs = true;
        await enqueueCapture((openedDatabase) => requeueRunningJobs(openedDatabase, getNow()));
      }

      do {
        isJobRunRequested = false;

        const openedDatabase = await getDatabase();

        await scheduleJobWake(getNow() + JOB_WAKE_DELAY_MS);

        // Asked once per pass: text generation waits while the user is active.
        while (
          await runNextJob(openedDatabase, jobRunners, {
            isPermitted: await (async () => {
              const isAway = await isUserAway();

              return (job: StoredJob) =>
                !GENERATION_JOBS.has(job.type) || isAway || isRequested(job);
            })(),
          })
        ) {
          // Each pass claims, runs and settles one job.
          hasRunAny = true;
        }
      } while (isJobRunRequested);
    } catch (error) {
      dependencies.reportError(error);
    } finally {
      isRunningJobs = false;
    }

    await scheduleJobWake();

    // New vectors can change the clusters: recompute once things are quiet.
    if (hasRunAny) {
      scheduleRecluster();
    }
  };

  /**
   * Records a model Ollama has, pinned to its digest, inactive until it passes
   * conformance like any installed model.
   *
   * @returns The model's ref.
   */
  const registerOllamaModel = async (name: string): Promise<string> => {
    const status = await readOllamaStatus(dependencies.fetchResource, ollamaOrigin);
    const pulled =
      status.state === "running" ? status.models.find((model) => model.name === name) : undefined;

    if (pulled === undefined) {
      throw new Error(`Ollama does not have ${name}.`);
    }

    const manifest = await buildOllamaManifest(
      dependencies.fetchResource,
      ollamaOrigin,
      pulled,
      findOllamaProfile(name),
    );
    const ref = getModelRef(manifest.reference);

    await (
      await getDatabase()
    ).put(MODEL_STORE, {
      ref,
      manifest,
      active: false,
      conformance: "pending",
      diskBytes: pulled.size,
      installedAt: getNow(),
    });

    return ref;
  };

  /**
   * Runs a model's conformance suite — its family's — and activates it if and
   * only if it passes; an embedding model then starts on what waits.
   */
  const activateWithConformance = async (ref: string, device: InferenceDevice) => {
    let probes: ProbeResult[] = [];

    const recorded = await activateModel({
      ref,
      database: await getDatabase(),
      runConformance: async (model) => {
        const { contract } = model.manifest;

        if (contract.family === "text-generation") {
          // Generation runs only through the local server: the extension's own
          // runtime stopped at the first spike's gate.
          if (model.manifest.reference.hub !== "ollama") {
            return {
              passed: false,
              probes: [],
              reason: "Text generation runs only through the local inference server for now.",
            };
          }

          const generator = createOllamaGenerator(
            dependencies.fetchResource,
            ollamaOrigin,
            model.manifest,
          );
          const outcome = await runGenerationConformance(generator.generate);

          probes = outcome.probes;

          return outcome;
        }

        const session = await loadModelSession(model, device);
        const outcome = await runEmbeddingConformance(contract, session.embed);

        probes = outcome.probes;

        return outcome;
      },
    });

    // Snapshots wait for either family: embedding, and fact extraction.
    if (recorded.active) {
      void queueSnapshotWork();
    }

    return { recorded, probes };
  };

  /**
   * Once Ollama answers again, hands back the jobs that stopped because it did
   * not. Asked only while local AI is paused, so a working setup costs nothing.
   */
  const resumeLocalAi = async (): Promise<void> => {
    if (!(await isLocalAiPaused(await getDatabase()))) {
      return;
    }

    const status = await readOllamaStatus(dependencies.fetchResource, ollamaOrigin);

    if (status.state === "running") {
      await enqueueCapture((openedDatabase) => requeuePausedJobs(openedDatabase, getNow()));
    }
  };

  /**
   * Queues the work the session's snapshots need — embedding, and fact
   * extraction while a generation model is active — then runs what is due.
   */
  const queueSnapshotWork = async (): Promise<void> => {
    await enqueueCapture(async (openedDatabase) => {
      await enqueueSnapshotEmbeddings(openedDatabase, getNow());
      await enqueueFactExtractions(openedDatabase);
      await enqueueEntityResolutions(openedDatabase);
    });
    await resumeLocalAi();
    await runJobs();
  };

  /**
   * Offers the active session a saved session to continue, once its first
   * search is recorded (REQ-STO-006). Off the capture queue — matching by
   * meaning loads the model — except for the write, which is re-checked there.
   */
  const checkReattach = async (searchNodeId: string): Promise<void> => {
    try {
      const openedDatabase = await getDatabase();
      const session = await getActiveSession(openedDatabase);

      if (
        session === undefined ||
        session.reattachSuggestion !== undefined ||
        session.reattachDeclined === true ||
        (await readSessionRoot(openedDatabase, session.id))?.id !== searchNodeId
      ) {
        return;
      }

      const model = await getActiveModel(openedDatabase, "embedding");
      const candidate = await findReattachCandidate({
        database: openedDatabase,
        sessionId: session.id,
        ...(model === undefined
          ? {}
          : {
              embedQueries: async (queries: readonly string[]) =>
                (await loadEmbeddingSession(model)).embed(queries, "query"),
            }),
      });

      if (candidate !== undefined) {
        await enqueueCapture((databaseInQueue) =>
          suggestReattach(databaseInQueue, session.id, {
            sessionId: candidate.sessionId,
            title: candidate.title,
          }),
        );
      }
    } catch (error) {
      dependencies.reportError(error);
    }
  };

  /** Answers a session page's observer. Runs on the capture queue. */
  const handleContentMessage = async (
    candidate: unknown,
    sender: PageSender,
  ): Promise<RpcMessage<string, unknown>> => {
    let request;

    try {
      request = parseRpcMessage(candidate, pageContentRequestSchemas);
    } catch (error) {
      return refuse(candidate, error);
    }

    let answer: RpcMessage<string, unknown> | undefined;
    let isSnapshotStored = false;

    await captureAndPush(async (openedDatabase) => {
      switch (request.type) {
        case "signal.batch": {
          const target = await recordSignalBatch(openedDatabase, sender, request.payload);

          if (target.node === undefined) {
            answer = buildRpcMessage("signal.dropped", { stop: target.stop });
            return;
          }

          await followFocus(openedDatabase);

          if (target.isCurrent) {
            await requestSnapshotIfDue(openedDatabase, target.node.id);
          }

          answer = buildRpcMessage("signal.recorded", {});
          return;
        }

        case "content.extracted": {
          const target = await readSignalTarget(openedDatabase, sender);

          // Text from a page the tab has already left is not its node's any more.
          if (target.node === undefined || !target.isCurrent) {
            answer = buildRpcMessage("signal.dropped", {
              stop: target.node === undefined && target.stop,
            });
            return;
          }

          await recordSnapshot(openedDatabase, {
            nodeId: target.node.id,
            ...request.payload,
            capturedAt: getNow(),
          });
          answer = buildRpcMessage("content.stored", {});
          isSnapshotStored = true;
          return;
        }
      }
    });

    // Not awaited into the answer: embedding takes seconds, the page needs none of it.
    if (isSnapshotStored) {
      void queueSnapshotWork();
    }

    return (
      answer ??
      buildRpcMessage("rpc.failed", {
        requestType: request.type,
        reason: "The page's message could not be recorded.",
      })
    );
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

        case "facts.reject": {
          const rejectionCount = await serializeWork(async () => {
            const openedDatabase = await getDatabase();
            const count = await rejectFacts(openedDatabase, request.payload.factIds, getNow());

            // A cluster's fact set may have changed: its summary is due again.
            await enqueueClusterSummaries(openedDatabase, getNow());
            await enqueueOpenQuestions(openedDatabase, getNow());

            return count;
          });

          void runJobs();

          return buildRpcMessage("facts.rejected", { rejectionCount });
        }

        case "facts.restoreRejections": {
          const restoredCount = await serializeWork(async () => {
            const openedDatabase = await getDatabase();
            const session = await getActiveSession(openedDatabase);
            const count =
              session === undefined ? 0 : await restoreRejections(openedDatabase, session.id);

            await enqueueClusterSummaries(openedDatabase, getNow());
            await enqueueOpenQuestions(openedDatabase, getNow());

            return count;
          });

          void runJobs();

          return buildRpcMessage("facts.rejectionsRestored", { restoredCount });
        }

        case "questions.read": {
          return buildRpcMessage("questions.view", {
            view: (await readOpenQuestions(await getDatabase())) ?? null,
          });
        }

        case "questions.refresh": {
          const queued = await serializeWork(async () =>
            requestOpenQuestions(await getDatabase(), getNow()),
          );

          if (queued) {
            void runJobs();
          }

          return buildRpcMessage("questions.refreshing", { queued });
        }

        case "gaps.read": {
          return buildRpcMessage("gaps.view", {
            gaps: (await readResearchGaps(await getDatabase(), request.payload.entityType)) ?? null,
          });
        }

        case "gaps.search": {
          const url = await openGapSearch(
            await getDatabase(),
            {
              createTab: (properties) => dependencies.resumeApi.createTab(properties),
              groupTabs: (options) => dependencies.sessionTabs.groupTabs(options),
            },
            request.payload.query,
          );

          return buildRpcMessage("gaps.searchOpened", { url });
        }

        case "table.read": {
          const view = await readComparisonTable(await getDatabase(), request.payload.entityType);

          return buildRpcMessage("table.view", {
            title: view?.title ?? "",
            table: view?.table ?? null,
          });
        }

        case "table.setColumns": {
          const { entityType, columns } = request.payload;

          await serializeWork(async () =>
            saveTableColumns(await getDatabase(), entityType, columns),
          );

          return buildRpcMessage("table.columnsSaved", { entityType });
        }

        case "summaries.read": {
          return buildRpcMessage("summaries.view", {
            session: (await readSummariesView(await getDatabase())) ?? null,
          });
        }

        case "summaries.refresh": {
          const { clusterId } = request.payload;
          const queued = await serializeWork(async () =>
            requestClusterSummary(await getDatabase(), clusterId, getNow()),
          );

          if (queued) {
            void runJobs();
          }

          return buildRpcMessage("summaries.refreshing", { clusterId, queued });
        }

        case "summaries.open": {
          await dependencies.openSummariesPage();

          return buildRpcMessage("summaries.opened", {});
        }

        case "entity.separate": {
          const separated = await serializeWork(async () =>
            separateEntity(await getDatabase(), request.payload.entityId),
          );

          return buildRpcMessage("entity.separated", {
            entityId: request.payload.entityId,
            separated,
          });
        }

        case "facts.extractNow": {
          const requestedAt = getNow();
          const queued = await serializeWork(async () => {
            const openedDatabase = await getDatabase();
            const jobs = await enqueueFactExtractions(openedDatabase);
            const pending = jobs.filter(
              ({ status }) => status === "queued" || status === "running",
            );
            const transaction = openedDatabase.transaction(JOB_STORE, "readwrite");

            // Marked on the job itself, so the request outlives an unload.
            await Promise.all([
              ...pending.map(async ({ id }) => {
                const stored = await transaction.store.get(id);

                if (stored !== undefined) {
                  await transaction.store.put({
                    ...stored,
                    payload: { ...(stored.payload as object), requestedAt },
                  });
                }
              }),
              transaction.done,
            ]);

            return pending.length;
          });

          void runJobs();

          return buildRpcMessage("facts.extractionStarted", { queued });
        }

        case "diagnostics.lifetimeProbe": {
          const runId = crypto.randomUUID();

          await enqueueJob(await getDatabase(), {
            type: LIFETIME_PROBE_JOB,
            inputHashes: [runId],
            producerVersion: "probe@1",
            // Ahead of embedding, so a run starts when asked.
            priority: 10,
            payload: { runId, ...request.payload },
          });
          void runJobs();

          return buildRpcMessage("diagnostics.probeStarted", { runId });
        }

        case "diagnostics.readProbes": {
          const heartbeats = await (await getDatabase()).getAll(HEARTBEAT_STORE);
          const byRun = Map.groupBy(heartbeats, ({ runId }) => runId);
          const now = getNow();
          const runs = [...byRun.values()]
            .flatMap((beats) => readProbeOutcome(beats, now) ?? [])
            .toSorted((a, b) => b.startedAt - a.startedAt)
            .slice(0, 20);

          return buildRpcMessage("diagnostics.probes", { runs });
        }

        case "diagnostics.read": {
          return buildRpcMessage("diagnostics.report", {
            blocked: dependencies.policyViolations.read(),
            permittedOrigins: [...MODEL_HOST_ORIGINS, ...LOCAL_INFERENCE_ORIGINS],
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

            if (model.manifest.contract.family !== "embedding") {
              throw new Error(
                "Throughput is measured for embedding models. A text-generation model is measured by its extraction time, under Ollama's page summaries.",
              );
            }

            const session = await loadModelSession(model, device);
            const measurement = await measureEmbeddingThroughput({
              session,
              modelRef: ref,
              database: openedDatabase,
            });

            // A local server keeps its own threads; there is nothing to report.
            if (model.manifest.reference.hub === "ollama") {
              return buildRpcMessage("benchmark.measured", { ref, ...measurement });
            }

            // Asked again rather than remembered: the figure is only
            // interpretable beside the thread count that produced it.
            const probe = await getWorkerForDevice(device).request("worker.ping", {});
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
            const { recorded, probes } = await activateWithConformance(ref, device);

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
            const { session, group } = await serializeWork(async () =>
              startSession({
                database: await getDatabase(),
                title: request.payload.title,
                api: dependencies.tabGroups,
              }),
            );

            // The group's first tab joined before the session was recorded, so
            // the membership event that would have marked it found no session.
            // A tab that cannot be marked is still the session's while it is
            // open; it is only not recognised if restored after its group is gone.
            dependencies.sessionTabs
              .setTabValue(group.tabId, SESSION_TAB_VALUE_KEY, session.id)
              .catch(() => undefined);

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
          return await serializeWork(async () => {
            const openedDatabase = await getDatabase();
            const session = await reconcileActiveSession({
              database: openedDatabase,
              getGroup: dependencies.tabGroups.getGroup,
            });
            const live = session ?? (await getLiveSession(openedDatabase));

            return buildRpcMessage("session.active", {
              session:
                session === undefined
                  ? null
                  : buildSessionSummary(
                      session,
                      await countSessionNodes(openedDatabase, session.id),
                    ),
              closedSession:
                live?.status === "closed"
                  ? buildSessionSummary(live, await countSessionNodes(openedDatabase, live.id))
                  : null,
            });
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

        case "session.save": {
          const openedDatabase = await getDatabase();
          const active = await getActiveSession(openedDatabase);

          if (active === undefined) {
            return buildRpcMessage("session.saveFailed", { reason: "No session is active." });
          }

          // The open pages send what they hold first; their batches reach the
          // capture queue before the save below, so nothing read is lost.
          const { nodes } = await readSessionGraph(openedDatabase, active.id);
          const tabIds = [
            ...new Set(nodes.filter((node) => node.tabState === "open").map((node) => node.tabId)),
          ];

          await Promise.allSettled(
            tabIds.map((tabId) =>
              Promise.race([
                dependencies.pageSignals.requestFlush(tabId),
                new Promise((resolve) => {
                  setTimer(() => {
                    resolve(undefined);
                  }, SAVE_FLUSH_TIMEOUT_MS);
                }),
              ]),
            ),
          );

          let saved: Awaited<ReturnType<typeof saveActiveSession>>;

          await captureAndPush(async (databaseInQueue) => {
            await trackActiveDwell({
              database: databaseInQueue,
              focusedTabId: undefined,
              now: getNow(),
            });
            saved = await saveActiveSession({
              database: databaseInQueue,
              queryGroupTabs: dependencies.tabCapture.queryGroupTabs,
              now: getNow(),
            });
          });

          if (saved === undefined) {
            return buildRpcMessage("session.saveFailed", {
              reason: "The session could not be saved.",
            });
          }

          // The session is saved already: closing its tabs changes nothing recorded.
          await closeTabsKeepingWindow(dependencies.closeTabs, saved.tabs).catch(
            dependencies.reportError,
          );

          return buildRpcMessage("session.saved", {
            sessionId: saved.session.id,
            title: saved.session.title,
          });
        }

        case "library.list": {
          return buildRpcMessage("library.listed", {
            sessions: await listSavedSessions(await getDatabase()),
          });
        }

        case "session.resume": {
          try {
            const resumed = await serializeWork(async () =>
              resumeSession({
                database: await getDatabase(),
                sessionId: request.payload.sessionId,
                api: dependencies.resumeApi,
                now: getNow(),
              }),
            );

            pushGraphSnapshot();
            void enqueueCapture((openedDatabase) =>
              injectSessionTabs(openedDatabase, dependencies.pageSignals),
            );

            return buildRpcMessage("session.resumed", {
              sessionId: resumed.id,
              title: resumed.title,
            });
          } catch (error) {
            return buildRpcMessage("session.resumeFailed", { reason: getErrorMessage(error) });
          }
        }

        case "session.reattach": {
          const { savedSessionId } = request.payload;
          let continued: Awaited<ReturnType<typeof reattachSession>> | undefined;
          let failure: string | undefined;

          await captureAndPush(async (openedDatabase) => {
            const active = await getActiveSession(openedDatabase);

            if (active === undefined) {
              failure = "No session is active.";
              return;
            }

            const searches = (
              await openedDatabase.getAllFromIndex(NODE_STORE, "sessionId", active.id)
            ).filter((node) => node.kind === "serp");

            try {
              continued = await reattachSession({
                database: openedDatabase,
                activeSessionId: active.id,
                savedSessionId,
                now: getNow(),
              });
            } catch (error) {
              failure = getErrorMessage(error);
              return;
            }

            // The searches carried over now share the saved session's first
            // search as their root, and refine it.
            for (const search of searches) {
              await linkRefinement(openedDatabase, { ...search, sessionId: savedSessionId });
            }
          });

          if (continued === undefined) {
            return buildRpcMessage("session.reattachFailed", {
              reason: failure ?? "The session could not be continued.",
            });
          }

          await dependencies.tabGroups
            .updateGroup(continued.groupId, { title: continued.title })
            .catch(dependencies.reportError);

          return buildRpcMessage("session.reattached", {
            sessionId: continued.id,
            title: continued.title,
          });
        }

        case "session.keepSeparate": {
          await serializeWork(async () => {
            const openedDatabase = await getDatabase();
            const active = await getActiveSession(openedDatabase);

            if (active !== undefined) {
              await declineReattach(openedDatabase, active.id);
            }
          });

          return buildRpcMessage("session.keptSeparate", {});
        }

        case "ollama.status": {
          if (!(await dependencies.hasOllamaAccess())) {
            return buildRpcMessage("ollama.state", { state: "notConnected", models: [] });
          }

          const status = await readOllamaStatus(dependencies.fetchResource, ollamaOrigin);

          // The user is looking at it: if Ollama is back, so is similarity.
          if (status.state === "running") {
            void queueSnapshotWork();
          }

          return buildRpcMessage("ollama.state", {
            state: status.state,
            models:
              status.state === "running"
                ? listOllamaModelEntries(
                    status.models,
                    await listInstalledOllamaModels(await getDatabase()),
                  )
                : [],
          });
        }

        case "ollama.register": {
          const { name } = request.payload;

          try {
            return buildRpcMessage("ollama.registered", {
              name,
              ref: await registerOllamaModel(name),
            });
          } catch (error) {
            return buildRpcMessage("ollama.registerFailed", {
              name,
              reason: getErrorMessage(error),
            });
          }
        }

        case "ollama.enable": {
          // One action from the user's click: download if missing, register,
          // check, activate — reporting which stage it is in.
          const { name } = request.payload;
          let stage: "downloading" | "checking" = "downloading";

          try {
            const status = await readOllamaStatus(dependencies.fetchResource, ollamaOrigin);

            if (status.state !== "running") {
              throw new Error(
                status.state === "refused"
                  ? "Ollama is refusing this extension."
                  : "Ollama isn't running.",
              );
            }

            const isPresent = (models: readonly { name: string }[]) =>
              models.find((model) => matchesOllamaName(name, model.name));
            let present = isPresent(status.models);

            if (present === undefined) {
              await pullOllamaModel(dependencies.fetchResource, ollamaOrigin, name, (progress) => {
                emit?.(
                  buildRpcMessage("ollama.enableProgress", {
                    name,
                    stage: "downloading",
                    ...(progress.total === undefined || progress.completed === undefined
                      ? {}
                      : { percent: Math.round((progress.completed / progress.total) * 100) }),
                  }),
                );
              });

              const after = await readOllamaStatus(dependencies.fetchResource, ollamaOrigin);

              present = after.state === "running" ? isPresent(after.models) : undefined;

              if (present === undefined) {
                throw new Error(`Ollama finished downloading but does not list ${name}.`);
              }
            }

            stage = "checking";
            emit?.(buildRpcMessage("ollama.enableProgress", { name, stage }));

            const ref = await registerOllamaModel(present.name);
            const { recorded } = await activateWithConformance(ref, "local-server");

            if (!recorded.active) {
              throw new Error(recorded.conformanceReason ?? "It did not pass the quality check.");
            }

            return buildRpcMessage("ollama.enabled", { name, ref });
          } catch (error) {
            return buildRpcMessage("ollama.enableFailed", {
              name,
              stage,
              reason: getErrorMessage(error),
            });
          }
        }

        case "ollama.pull": {
          const { name } = request.payload;

          try {
            await pullOllamaModel(dependencies.fetchResource, ollamaOrigin, name, (progress) => {
              emit?.(buildRpcMessage("ollama.pullProgress", { name, ...progress }));
            });

            return buildRpcMessage("ollama.pulled", { name });
          } catch (error) {
            return buildRpcMessage("ollama.pullFailed", { name, reason: getErrorMessage(error) });
          }
        }

        case "ollama.health": {
          return buildRpcMessage("ollama.healthReport", {
            isPaused: await isLocalAiPaused(await getDatabase()),
          });
        }

        case "generation.measure": {
          const model = await getActiveModel(await getDatabase(), "text-generation");

          if (model === undefined) {
            return buildRpcMessage("generation.measureFailed", {
              reason: "Page summaries are not on: no text-generation model is active.",
            });
          }

          const generator = createOllamaGenerator(
            dependencies.fetchResource,
            ollamaOrigin,
            model.manifest,
          );
          const startedAt = getNow();
          let characters = 0;
          // Firefox unloads an event page after 30 s without activity, and a
          // pending answer is not activity (spike M0-1), so the background is
          // held while it waits. The progress, every second, is for the card.
          const release = holdBackgroundAlive(dependencies.backgroundLifetime.touch);
          const progress = setInterval(() => {
            emit?.(
              buildRpcMessage("generation.measureProgress", {
                elapsedMs: getNow() - startedAt,
                characters,
              }),
            );
          }, EXTRACTION_PROGRESS_INTERVAL_MS);

          try {
            const measured = await measureExtractionTime((generateRequest) => {
              const stream = generator.generate(generateRequest);

              void (async () => {
                for await (const { delta } of stream) {
                  characters += delta.length;
                }
              })().catch(() => undefined);

              return stream;
            });

            return buildRpcMessage("generation.measured", { ref: model.ref, ...measured });
          } catch (error) {
            return buildRpcMessage("generation.measureFailed", { reason: getErrorMessage(error) });
          } finally {
            clearInterval(progress);
            release();
          }
        }

        case "recorded.open": {
          await dependencies.openRecordedPage();

          return buildRpcMessage("recorded.opened", {});
        }

        case "recorded.read": {
          return buildRpcMessage("recorded.session", {
            session: (await readRecordedSession(await getDatabase())) ?? null,
          });
        }

        case "recorded.readText": {
          const { nodeId } = request.payload;

          return buildRpcMessage("recorded.text", {
            nodeId,
            text: await readRecordedText(await getDatabase(), nodeId),
          });
        }

        case "node.delete": {
          const { nodeId } = request.payload;
          let deleted = false;

          // On the capture queue, so no capture write interleaves with the
          // cascade; the clusters are recomputed without the page afterwards.
          await captureAndPush(async (openedDatabase) => {
            deleted = await deleteNode(openedDatabase, nodeId);
          });

          return buildRpcMessage("node.deleted", { nodeId, deleted });
        }

        case "session.delete": {
          const { sessionId } = request.payload;
          let deleted = false;

          await captureAndPush(async (openedDatabase) => {
            deleted = await deleteSession(openedDatabase, sessionId);
          });

          return buildRpcMessage("session.deleted", { sessionId, deleted });
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
      // The hold page only keeps the background company; it sends nothing.
      if (port.name === HOLD_PORT_NAME) {
        holdPorts.add(port);
        port.onDisconnect.addListener(() => {
          holdPorts.delete(port);
        });

        return;
      }

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
      await serializeWork(async () => {
        if (group.title !== undefined) {
          await renameSessionForGroup(await getDatabase(), group.id, group.title);
        }
      });
      pushGraphSnapshot();
    },
    handleGroupCreated: async (group) => {
      const reopened = await serializeWork(async () =>
        reopenSessionForGroup(await getDatabase(), group.id),
      );

      // The group's tabs come back under new ids, so the nodes still open for
      // the old ones are closed; the tabs are recorded as each one arrives.
      if (reopened !== undefined) {
        await reconcileTabs();
      }
    },
    handleGroupRemoved: async (group) => {
      await serializeWork(async () => {
        const openedDatabase = await getDatabase();

        // Reading time up to now is counted before the session closes, when
        // it could no longer be.
        await trackActiveDwell({
          database: openedDatabase,
          focusedTabId: undefined,
          now: getNow(),
        });
        await closeSessionForGroup(openedDatabase, group.id);
      });
      pushGraphSnapshot();
    },
    handleTabCreated: async (tab) => {
      const outcome = await serializeWork(async () =>
        restoreSessionTab({
          database: await getDatabase(),
          api: dependencies.sessionTabs,
          tab,
        }),
      );

      // A session tab that came back is recorded from the page it shows: most
      // restored tabs are discarded and commit no navigation until shown. A
      // tab newly opened in the group (`member`) is left to its first commit.
      if (outcome !== "ignored" && outcome !== "member") {
        await captureAndPush(async (openedDatabase) => {
          await followTabMembership({
            database: openedDatabase,
            tab: await dependencies.tabCapture.getTab(tab.id),
          });
          await observeIfCaptured(openedDatabase, tab.id);
        });
      }
    },
    handleTabGroupChanged: (tab) =>
      serializeWork(async () => {
        await trackSessionTabMembership({
          database: await getDatabase(),
          api: dependencies.sessionTabs,
          tab,
        });
      }),
    reconcileSession: async () => {
      // Snapshots an earlier version stored in the clear are encrypted first.
      // Reported rather than thrown: a failure must not keep the session from
      // being reconciled, and the next start tries again.
      await enqueueCapture(sealPlaintextSnapshots);
      await serializeWork(async () => {
        await reconcileActiveSession({
          database: await getDatabase(),
          getGroup: dependencies.tabGroups.getGroup,
        });
      });
      await reconcileTabs();
      await recluster();
      // A job the last run was in the middle of is handed back by the first
      // run of jobs after this load, then resumed.
      void queueSnapshotWork();
    },
    handleNavigationCommitted: (navigation) =>
      captureAndPush(async (openedDatabase) => {
        const node = await recordNavigation({
          database: openedDatabase,
          api: dependencies.tabCapture,
          navigation,
        });

        if (node !== undefined) {
          observeTab(node.tabId);

          if (node.kind === "serp") {
            void checkReattach(node.id);
          }
        } else if (navigation.frameId === 0) {
          // A page the tab's node already had, loaded again — a resumed tab
          // loading when shown — is observed like a new one.
          await observeIfCaptured(openedDatabase, navigation.tabId);
        }

        // The tab being read may now show another node.
        await followFocus(openedDatabase);
      }),
    handleTabUpdated: (tab, changes) =>
      captureAndPush(async (openedDatabase) => {
        if (changes.groupId !== undefined) {
          await followTabMembership({ database: openedDatabase, tab });
          await observeIfCaptured(openedDatabase, tab.id);
          await followFocus(openedDatabase);
        }

        if (changes.title !== undefined) {
          await updateTabTitle(openedDatabase, tab.id, changes.title);
        }
      }),
    handleTabActivated: (tabId) =>
      captureAndPush(async (openedDatabase) => {
        await recordTabFocus(openedDatabase, tabId);
        await followFocus(openedDatabase);
      }),
    handleTabRemoved: async (tabId, { isWindowClosing }) => {
      if (!isWindowClosing) {
        await captureAndPush(async (openedDatabase) => {
          await closeTabNode(openedDatabase, tabId);
          await followFocus(openedDatabase);
        });
      }
    },
    handleContentMessage,
    handleWindowFocusChanged: () => captureAndPush((openedDatabase) => followFocus(openedDatabase)),
    handleIdleStateChanged: async (state: IdleState) => {
      // The user stepped away: text generation may run now (REQ-MOD-008).
      if (state !== "active") {
        void runJobs();
      }

      await captureAndPush((openedDatabase) =>
        followFocus(openedDatabase, {
          // Idleness is reported a threshold after input stopped; reading
          // stopped with the input.
          now:
            state === "active" ? getNow() : getNow() - ENGAGEMENT_RULES.idleThresholdSeconds * 1000,
        }),
      );
    },
    handlePermissionsAdded: () =>
      enqueueCapture(async (openedDatabase) => {
        void injectSessionTabs(openedDatabase, dependencies.pageSignals);
      }),
    handleAlarm: async (name) => {
      if (name === JOB_WAKE_ALARM) {
        await runJobs();
      }
    },
    shutdown: () => {
      discardWorker();
      database = undefined;
    },
  };
};
