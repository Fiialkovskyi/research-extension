import { DATA_TOPICS } from "@/features/liveData";
import { describe, expect, it, vi } from "vitest";

import "fake-indexeddb/auto";

import { type BackgroundApp, createBackgroundApp, type BackgroundDependencies } from ".";
import { IN_BROWSER_BACKEND_OFF_REASON } from "./constants";
import { JOB_WAKE_ALARM } from "@/features/jobQueue";
import type { InferenceWorker } from "@/features/inference";
import { EXTRACTION_PROBES, PARAPHRASE_PROBES } from "@/features/modelConformance";
import { RECLUSTER_DELAY_MS } from "@/features/researchClusters";
import { SESSION_TAB_VALUE_KEY, type SessionTabApi } from "@/features/researchSession";
import type { CaptureTab, TabCaptureApi } from "@/features/tabCapture";
import type { TabGroupApi } from "@/features/tabGroups";
import { getFileDigest } from "@/features/modelInstall/model/assertFileDigest/utils/getFileDigest";
import type { TurnOnProgress } from "@/features/aiSetup";
import { LOCAL_INFERENCE_ORIGINS, MINILM_L6_V2 } from "@/shared/config";
import { buildRpcMessage } from "@/shared/rpc";
import {
  AI_SETUP_STORE,
  SETTINGS_STORE,
  PAGE_METADATA_STORE,
  CHUNK_STORE,
  CLUSTERING_STORE,
  EDGE_STORE,
  ENTITY_STORE,
  EXTRACTION_STORE,
  FACT_STORE,
  HEARTBEAT_STORE,
  JOB_STORE,
  SPACE_STORE,
  VECTOR_STORE,
  KEY_STORE,
  MODEL_FILE_STORE,
  MODEL_STORE,
  NODE_STORE,
  openResearchDatabase,
  SESSION_STORE,
  SNAPSHOT_STORE,
  REJECTION_STORE,
  SUMMARY_STORE,
  TABLE_COLUMNS_STORE,
  QUESTION_STORE,
  BLOCKED_SITES_STORE,
  type StoredJob,
  type StoredSession,
} from "@/shared/storage";

const pong = { availableDevices: ["wasm"] as const, crossOriginIsolated: false, threadCount: 1 };

const createStubWorker = (overrides: Partial<InferenceWorker> = {}): InferenceWorker => {
  return {
    request: vi.fn().mockResolvedValue(buildRpcMessage("worker.pong", pong)),
    terminate: vi.fn(),
    ...overrides,
  };
};

/** Tab calls that succeed, as a browser that allows grouping would. */
const createStubTabGroups = (overrides: Partial<TabGroupApi> = {}): TabGroupApi => {
  return {
    createTab: vi.fn().mockResolvedValue({ id: 7 }),
    groupTabs: vi.fn().mockResolvedValue(42),
    updateGroup: vi.fn().mockResolvedValue(undefined),
    getGroup: vi.fn().mockResolvedValue({ color: "blue" }),
    activateTab: vi.fn().mockResolvedValue(undefined),
    removeTab: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
};

/**
 * Per-tab values held in memory, as Firefox's session store holds them, with
 * grouping calls that succeed. `groups` lists the ids that exist.
 */
const createStubSessionTabs = (
  groups: number[] = [42],
  overrides: Partial<SessionTabApi> = {},
): SessionTabApi & { values: Map<string, string> } => {
  const values = new Map<string, string>();
  let nextGroupId = 100;

  return {
    values,
    getTabValue: vi.fn(async (tabId: number, key: string) => values.get(`${tabId}:${key}`)),
    setTabValue: vi.fn(async (tabId: number, key: string, value: string) => {
      values.set(`${tabId}:${key}`, value);
    }),
    removeTabValue: vi.fn(async (tabId: number, key: string) => {
      values.delete(`${tabId}:${key}`);
    }),
    groupTabs: vi.fn(async ({ groupId }: { groupId?: number }) => {
      if (groupId !== undefined) {
        return groupId;
      }

      nextGroupId += 1;
      groups.push(nextGroupId);
      return nextGroupId;
    }),
    updateGroup: vi.fn().mockResolvedValue(undefined),
    getGroup: vi.fn(async (groupId: number) => {
      if (!groups.includes(groupId)) {
        throw new Error(`No group with id: ${groupId}`);
      }

      return { id: groupId };
    }),
    ...overrides,
  };
};

/** Dependencies with inert defaults, so a test names only what it cares about. */
const buildDependencies = (
  overrides: Partial<BackgroundDependencies> = {},
): BackgroundDependencies => {
  return {
    createInferenceWorker: () => createStubWorker(),
    openDatabase: () => Promise.reject(new Error("no database in this test")),
    fetchResource: (() => Promise.reject(new Error("no network in this test"))) as typeof fetch,
    policyViolations: { read: () => [] },
    tabGroups: createStubTabGroups(),
    sessionTabs: createStubSessionTabs(),
    persistStorage: () => Promise.resolve(true),
    tabCapture: {
      getTab: () => Promise.reject(new Error("no tabs in this test")),
      queryGroupTabs: () => Promise.resolve([]),
    },
    reportError: () => {},
    focusTab: () => Promise.resolve(),
    openMap: () => Promise.resolve(),
    openRecordedPage: () => Promise.resolve(),
    openSummariesPage: () => Promise.resolve(),
    openSetupPage: () => Promise.resolve(),
    showSetupNotification: () => Promise.resolve(),
    setBadge: () => Promise.resolve(),
    pageSignals: {
      executeScript: () => Promise.resolve([]),
      requestPageText: () => Promise.resolve(undefined),
      requestFlush: () => Promise.resolve(undefined),
      requestNotice: () => Promise.resolve(undefined),
    },
    readFocusedTab: () => Promise.resolve(undefined),
    readIdleState: () => Promise.resolve("active"),
    // Most of this suite drives the in-extension backend with Hugging Face
    // fixtures; the tests that need it switched off say so.
    isInBrowserBackendEnabled: true,
    backgroundLifetime: {
      touch: () => Promise.resolve(),
      scheduleWake: () => Promise.resolve(),
      openHoldPage: () => Promise.reject(new Error("no tabs in this test")),
      closeTab: () => Promise.resolve(),
    },
    resumeApi: {
      createTab: () => Promise.reject(new Error("no tabs in this test")),
      groupTabs: () => Promise.reject(new Error("no groups in this test")),
      updateGroup: () => Promise.resolve(),
      getGroup: () => Promise.reject(new Error("no groups in this test")),
      activateTab: () => Promise.resolve(),
      removeTab: () => Promise.resolve(),
    },
    // No recompute of clusters unless a test drives the timer itself.
    setTimer: () => undefined,
    clearTimer: () => {},
    ...overrides,
  };
};

const encode = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

/** A worker that fails every load, as a poisoned runtime would. */
const createFailingWorker = () => {
  return createStubWorker({
    request: vi.fn((type: string) =>
      type === "model.load"
        ? Promise.reject(new Error("no available backend found"))
        : Promise.resolve(buildRpcMessage("worker.pong", pong)),
    ) as unknown as InferenceWorker["request"],
  });
};

/** An empty database, so one test's installs cannot be seen by the next. */
const createFreshDatabase = async () => {
  const database = await openResearchDatabase();

  await database.clear(MODEL_STORE);
  await database.clear(MODEL_FILE_STORE);
  await database.clear(SESSION_STORE);
  await database.clear(NODE_STORE);
  await database.clear(EDGE_STORE);
  await database.clear(SNAPSHOT_STORE);
  await database.clear(KEY_STORE);
  await database.clear(CLUSTERING_STORE);
  await database.clear(JOB_STORE);
  await database.clear(SPACE_STORE);
  await database.clear(CHUNK_STORE);
  await database.clear(VECTOR_STORE);
  await database.clear(FACT_STORE);
  await database.clear(EXTRACTION_STORE);
  await database.clear(ENTITY_STORE);
  await database.clear(SUMMARY_STORE);
  await database.clear(REJECTION_STORE);
  await database.clear(TABLE_COLUMNS_STORE);
  await database.clear(QUESTION_STORE);
  await database.clear(BLOCKED_SITES_STORE);
  await database.clear(AI_SETUP_STORE);
  await database.clear(SETTINGS_STORE);
  await database.clear(PAGE_METADATA_STORE);

  return database;
};

/** A stand-in for a runtime port, capturing what the background posts back. */
const createFakePort = () => {
  const listeners: ((message: unknown) => void)[] = [];
  const disconnectListeners: (() => void)[] = [];
  const posted: unknown[] = [];

  return {
    posted,
    port: {
      postMessage: (message: unknown) => posted.push(message),
      onMessage: {
        addListener: (listener: (message: unknown) => void) => listeners.push(listener),
      },
      onDisconnect: {
        addListener: (listener: () => void) => disconnectListeners.push(listener),
      },
    },
    send: (message: unknown) => {
      for (const listener of listeners) {
        listener(message);
      }
    },
    disconnect: () => {
      for (const listener of disconnectListeners) {
        listener();
      }
    },
  };
};

describe("createBackgroundApp", () => {
  it("answers a probe with what the worker reports", async () => {
    const app = createBackgroundApp(buildDependencies());

    const response = await app.handleMessage(buildRpcMessage("inference.probe", {}));

    expect(response).toMatchObject({ type: "inference.capabilities", payload: pong });
  });

  it("starts no worker until something is actually asked of it", () => {
    const createInferenceWorker = vi.fn(() => createStubWorker());

    createBackgroundApp(buildDependencies({ createInferenceWorker }));

    expect(createInferenceWorker).not.toHaveBeenCalled();
  });

  it("reuses one worker across requests, rather than spawning per message", async () => {
    const createInferenceWorker = vi.fn(() => createStubWorker());
    const app = createBackgroundApp(buildDependencies({ createInferenceWorker }));

    await app.handleMessage(buildRpcMessage("inference.probe", {}));
    await app.handleMessage(buildRpcMessage("inference.probe", {}));

    expect(createInferenceWorker).toHaveBeenCalledTimes(1);
  });

  it("refuses a message type it does not handle", async () => {
    const app = createBackgroundApp(buildDependencies());

    const response = await app.handleMessage(buildRpcMessage("session.start", {}));

    expect(response).toMatchObject({ type: "rpc.refused" });
    expect(response.payload).toMatchObject({
      rejection: "unknown-type",
      reason: expect.stringContaining("session.start"),
    });
  });

  it("refuses something that is not an envelope at all", async () => {
    const app = createBackgroundApp(buildDependencies());

    expect(await app.handleMessage("nonsense")).toMatchObject({
      type: "rpc.refused",
      payload: { rejection: "not-an-envelope" },
    });
  });

  it("refuses a payload its schema does not admit, saying which check failed", async () => {
    const app = createBackgroundApp(buildDependencies());

    const response = await app.handleMessage(buildRpcMessage("model.activate", { ref: "" }));

    expect(response).toMatchObject({
      type: "rpc.refused",
      payload: { rejection: "invalid-payload" },
    });
  });

  it("answers an unexpected failure with the request it belonged to", async () => {
    const app = createBackgroundApp(buildDependencies());

    const response = await app.handleMessage(buildRpcMessage("model.list", {}));

    expect(response).toMatchObject({
      type: "rpc.failed",
      payload: { requestType: "model.list", reason: "no database in this test" },
    });
  });

  it("reports a worker failure as a reason rather than throwing at the surface", async () => {
    const worker = createStubWorker({
      request: vi.fn().mockRejectedValue(new Error("worker crashed")),
    });
    const app = createBackgroundApp(buildDependencies({ createInferenceWorker: () => worker }));

    const response = await app.handleMessage(buildRpcMessage("inference.probe", {}));

    expect(response).toMatchObject({ type: "inference.failed" });
    expect(response.payload).toMatchObject({ reason: expect.stringContaining("worker crashed") });
  });

  it("reports an unexpected worker response instead of passing it on", async () => {
    const worker = createStubWorker({
      request: vi
        .fn()
        .mockResolvedValue(
          buildRpcMessage("worker.error", { requestType: "worker.ping", reason: "bad" }),
        ),
    });
    const app = createBackgroundApp(buildDependencies({ createInferenceWorker: () => worker }));

    const response = await app.handleMessage(buildRpcMessage("inference.probe", {}));

    expect(response).toMatchObject({ type: "inference.failed" });
  });

  it("releases the worker on shutdown", async () => {
    const worker = createStubWorker();
    const app = createBackgroundApp(buildDependencies({ createInferenceWorker: () => worker }));

    await app.handleMessage(buildRpcMessage("inference.probe", {}));
    app.shutdown();

    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("shuts down safely when no worker was ever started", () => {
    const app = createBackgroundApp(buildDependencies());

    expect(() => app.shutdown()).not.toThrow();
  });

  describe("over a port", () => {
    it("answers a request on the same port it arrived on", async () => {
      const app = createBackgroundApp(buildDependencies());
      const { port, posted, send } = createFakePort();

      app.attachPort(port);
      send(buildRpcMessage("inference.probe", {}));
      await vi.waitFor(() => expect(posted).toHaveLength(1));

      expect(posted[0]).toMatchObject({ type: "inference.capabilities", payload: pong });
    });

    it("answers each of several requests on one port", async () => {
      const app = createBackgroundApp(buildDependencies());
      const { port, posted, send } = createFakePort();

      app.attachPort(port);
      send(buildRpcMessage("inference.probe", {}));
      send(buildRpcMessage("inference.probe", {}));
      await vi.waitFor(() => expect(posted).toHaveLength(2));

      expect(
        posted.every((message) => (message as { type: string }).type === "inference.capabilities"),
      ).toBe(true);
    });

    it("reports a refusal over the port rather than staying silent", async () => {
      const app = createBackgroundApp(buildDependencies());
      const { port, posted, send } = createFakePort();

      app.attachPort(port);
      send("nonsense");
      await vi.waitFor(() => expect(posted).toHaveLength(1));

      expect(posted[0]).toMatchObject({ type: "rpc.refused" });
    });

    it("serves two ports independently", async () => {
      const app = createBackgroundApp(buildDependencies());
      const first = createFakePort();
      const second = createFakePort();

      app.attachPort(first.port);
      app.attachPort(second.port);
      first.send(buildRpcMessage("inference.probe", {}));
      await vi.waitFor(() => expect(first.posted).toHaveLength(1));

      expect(second.posted).toHaveLength(0);
    });
  });

  it("starts a fresh worker after a shutdown", async () => {
    const createInferenceWorker = vi.fn(() => createStubWorker());
    const app = createBackgroundApp(buildDependencies({ createInferenceWorker }));

    await app.handleMessage(buildRpcMessage("inference.probe", {}));
    app.shutdown();
    await app.handleMessage(buildRpcMessage("inference.probe", {}));

    expect(createInferenceWorker).toHaveBeenCalledTimes(2);
  });
});

describe("installing a model through the background", () => {
  const configJson = '{"model_type":"bert","hidden_size":384,"max_position_embeddings":512}';
  const tokenizerConfigJson = '{"model_max_length":512}';

  const buildBody = (path: string) =>
    path === "config.json"
      ? configJson
      : path === "tokenizer_config.json"
        ? tokenizerConfigJson
        : `contents of ${path}`;

  /** A listing covering every file the default profile installs. */
  const buildTree = async () => {
    const paths = [...MINILM_L6_V2.files, "tokenizer_config.json"];

    return Promise.all(
      [...new Set(paths)].map(async (path) => ({
        type: "file",
        path,
        size: new TextEncoder().encode(buildBody(path)).byteLength,
        lfs: { oid: await getFileDigest(encode(buildBody(path)), "sha256") },
      })),
    );
  };

  const createStubHubFetch = (tree: unknown, corrupt = false) => {
    return vi.fn((rawUrl: string) => {
      const url = String(rawUrl);

      if (url.includes("/tree/")) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(tree) });
      }

      const path = [...MINILM_L6_V2.files, "tokenizer_config.json"].find((candidate) =>
        url.endsWith(`/${candidate}`),
      );
      const text = corrupt && path?.endsWith(".onnx") ? "tampered" : buildBody(path ?? "");

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(JSON.parse(text)),
        arrayBuffer: () => Promise.resolve(encode(text)),
      });
    }) as unknown as typeof fetch;
  };

  it("touches neither the network nor storage until asked", () => {
    const fetchResource = vi.fn() as unknown as typeof fetch;
    const openDatabase = vi.fn();

    createBackgroundApp(buildDependencies({ fetchResource, openDatabase }));

    expect(fetchResource).not.toHaveBeenCalled();
    expect(openDatabase).not.toHaveBeenCalled();
  });

  it("installs a bundled profile and reports where it landed", async () => {
    const database = await createFreshDatabase();
    const app = createBackgroundApp(
      buildDependencies({
        openDatabase: () => Promise.resolve(database),
        fetchResource: createStubHubFetch(await buildTree()),
      }),
    );

    const response = await app.handleMessage(
      buildRpcMessage("model.install", { repository: MINILM_L6_V2.repository }),
    );

    expect(response).toMatchObject({
      type: "model.installed",
      payload: {
        ref: `${MINILM_L6_V2.repository}@${MINILM_L6_V2.revision}`,
        conformance: "pending",
      },
    });
  });

  it("refuses a repository that is not a bundled profile", async () => {
    const app = createBackgroundApp(buildDependencies());

    const response = await app.handleMessage(
      buildRpcMessage("model.install", { repository: "someone/untrusted-model" }),
    );

    expect(response).toMatchObject({ type: "model.installFailed" });
    expect(response.payload).toMatchObject({
      reason: expect.stringContaining("someone/untrusted-model"),
    });
  });

  it("reports an install failure as a reason rather than throwing", async () => {
    const database = await createFreshDatabase();
    const app = createBackgroundApp(
      buildDependencies({
        openDatabase: () => Promise.resolve(database),
        fetchResource: createStubHubFetch(await buildTree(), true),
      }),
    );

    const response = await app.handleMessage(
      buildRpcMessage("model.install", { repository: MINILM_L6_V2.repository }),
    );

    expect(response).toMatchObject({ type: "model.installFailed" });
    expect(response.payload).toMatchObject({
      reason: expect.stringContaining("does not match its manifest"),
    });
  });

  it("streams progress over a port, with the outcome last", async () => {
    const database = await createFreshDatabase();
    const app = createBackgroundApp(
      buildDependencies({
        openDatabase: () => Promise.resolve(database),
        fetchResource: createStubHubFetch(await buildTree()),
      }),
    );
    const { port, posted, send } = createFakePort();

    app.attachPort(port);
    send(buildRpcMessage("model.install", { repository: MINILM_L6_V2.repository }));

    await vi.waitFor(() => expect(posted.at(-1)).toMatchObject({ type: "model.installed" }));

    const types = posted.map((message) => (message as { type: string }).type);

    expect(types.filter((type) => type === "model.installProgress").length).toBeGreaterThan(0);
    expect(types.at(-1)).toBe("model.installed");
  });

  it("still answers a one-shot install, dropping the progress it cannot stream", async () => {
    const database = await createFreshDatabase();
    const app = createBackgroundApp(
      buildDependencies({
        openDatabase: () => Promise.resolve(database),
        fetchResource: createStubHubFetch(await buildTree()),
      }),
    );

    await expect(
      app.handleMessage(buildRpcMessage("model.install", { repository: MINILM_L6_V2.repository })),
    ).resolves.toMatchObject({ type: "model.installed" });
  });

  it("opens the database once across several installs", async () => {
    const database = await createFreshDatabase();
    const openDatabase = vi.fn(() => Promise.resolve(database));
    const app = createBackgroundApp(
      buildDependencies({ openDatabase, fetchResource: createStubHubFetch(await buildTree()) }),
    );

    await app.handleMessage(
      buildRpcMessage("model.install", { repository: MINILM_L6_V2.repository }),
    );
    await app.handleMessage(
      buildRpcMessage("model.install", { repository: MINILM_L6_V2.repository }),
    );

    expect(openDatabase).toHaveBeenCalledTimes(1);
  });
});

describe("the in-extension backend switched off", () => {
  const installed = {
    ref: "owner/model@abc",
    manifest: {
      manifestVersion: 1,
      reference: { hub: "huggingface", repository: "owner/model", revision: "a".repeat(40) },
      format: "onnx",
      files: [
        { path: "config.json", digest: { algorithm: "sha256", value: "a".repeat(64) }, bytes: 2 },
      ],
      license: "Apache-2.0",
      contract: {
        family: "embedding",
        dimensions: 384,
        maxInputTokens: 512,
        pooling: "mean",
        normalize: true,
        similarity: "cosine",
        prefixes: { query: "", document: "" },
      },
    },
    active: true,
    conformance: "passed",
    diskBytes: 2,
    installedAt: 1,
  } as const;

  const createApp = async (fetchResource = vi.fn() as unknown as typeof fetch) => {
    const database = await createFreshDatabase();
    const createInferenceWorker = vi.fn(() => createStubWorker());

    await database.put(MODEL_STORE, installed as never);

    const app = createBackgroundApp(
      buildDependencies({
        isInBrowserBackendEnabled: false,
        openDatabase: () => Promise.resolve(database),
        fetchResource,
        createInferenceWorker,
      }),
    );

    return { app, fetchResource, createInferenceWorker };
  };

  it("refuses to install a bundled profile, without reaching a model host", async () => {
    const { app, fetchResource } = await createApp();

    const response = await app.handleMessage(
      buildRpcMessage("model.install", { repository: MINILM_L6_V2.repository }),
    );

    expect(response).toMatchObject({
      type: "model.installFailed",
      payload: { reason: IN_BROWSER_BACKEND_OFF_REASON },
    });
    expect(fetchResource).not.toHaveBeenCalled();
  });

  it("refuses to activate an in-extension model, without loading it", async () => {
    const { app, createInferenceWorker } = await createApp();

    const response = await app.handleMessage(
      buildRpcMessage("model.activate", { ref: installed.ref, device: "wasm" }),
    );

    expect(response).toMatchObject({
      type: "model.activationFailed",
      payload: { reason: IN_BROWSER_BACKEND_OFF_REASON },
    });
    expect(createInferenceWorker).not.toHaveBeenCalled();
  });

  it("refuses to measure an in-extension model", async () => {
    const { app, createInferenceWorker } = await createApp();

    const response = await app.handleMessage(
      buildRpcMessage("benchmark.run", { ref: installed.ref, device: "wasm" }),
    );

    expect(response).toMatchObject({
      type: "benchmark.failed",
      payload: { reason: IN_BROWSER_BACKEND_OFF_REASON },
    });
    expect(createInferenceWorker).not.toHaveBeenCalled();
  });

  it("reports no model host among the permitted origins", async () => {
    const { app } = await createApp();

    const response = await app.handleMessage(buildRpcMessage("diagnostics.read", {}));

    expect(response).toMatchObject({
      type: "diagnostics.report",
      payload: { permittedOrigins: [...LOCAL_INFERENCE_ORIGINS] },
    });
  });
});

describe("the background's worker and the compute path", () => {
  const installed = {
    ref: "owner/model@abc",
    manifest: {
      manifestVersion: 1,
      reference: { hub: "huggingface", repository: "owner/model", revision: "a".repeat(40) },
      format: "onnx",
      quantization: "q8",
      files: [
        { path: "config.json", digest: { algorithm: "sha256", value: "a".repeat(64) }, bytes: 2 },
      ],
      license: "Apache-2.0",
      contract: {
        family: "embedding",
        dimensions: 384,
        maxInputTokens: 512,
        pooling: "mean",
        normalize: true,
        similarity: "cosine",
        prefixes: { query: "", document: "" },
      },
    },
    active: false,
    conformance: "pending",
    diskBytes: 2,
    installedAt: 1,
  } as const;

  const createDatabaseWithModel = async () => {
    const database = await createFreshDatabase();

    await database.put(MODEL_STORE, installed as never);
    await database.put(MODEL_FILE_STORE, {
      ref: installed.ref,
      path: "config.json",
      contents: encode("{}"),
    });

    return database;
  };

  it("starts a fresh worker when the compute path changes", async () => {
    const workers = [createFailingWorker(), createFailingWorker()];
    const createInferenceWorker = vi.fn(() => workers.shift() ?? createFailingWorker());
    const database = await createDatabaseWithModel();
    const app = createBackgroundApp(
      buildDependencies({ createInferenceWorker, openDatabase: () => Promise.resolve(database) }),
    );

    await app.handleMessage(
      buildRpcMessage("model.activate", { ref: installed.ref, device: "wasm" }),
    );
    await app.handleMessage(
      buildRpcMessage("model.activate", { ref: installed.ref, device: "webgpu" }),
    );

    // The runtime memoises its backend per realm, so the second path needs a
    // worker that has not already tried the first.
    expect(createInferenceWorker.mock.calls.length).toBeGreaterThan(1);
  });

  it("discards a worker whose load failed, rather than asking it again", async () => {
    const createInferenceWorker = vi.fn(() => createFailingWorker());
    const database = await createDatabaseWithModel();
    const app = createBackgroundApp(
      buildDependencies({ createInferenceWorker, openDatabase: () => Promise.resolve(database) }),
    );

    await app.handleMessage(
      buildRpcMessage("model.activate", { ref: installed.ref, device: "wasm" }),
    );
    await app.handleMessage(
      buildRpcMessage("model.activate", { ref: installed.ref, device: "wasm" }),
    );

    // Asking the same poisoned worker again would fail identically and read as
    // a defect in the model.
    expect(createInferenceWorker).toHaveBeenCalledTimes(2);
  });

  it("reports an activation failure as a reason", async () => {
    const database = await createDatabaseWithModel();
    const app = createBackgroundApp(
      buildDependencies({
        createInferenceWorker: () => createFailingWorker(),
        openDatabase: () => Promise.resolve(database),
      }),
    );

    const response = await app.handleMessage(
      buildRpcMessage("model.activate", { ref: installed.ref, device: "wasm" }),
    );

    expect(response.type).toBe("model.activationFailed");
  });

  it("keeps one worker while the path stays the same and loads succeed", async () => {
    const createInferenceWorker = vi.fn(() => createStubWorker());
    const app = createBackgroundApp(buildDependencies({ createInferenceWorker }));

    await app.handleMessage(buildRpcMessage("inference.probe", {}));
    await app.handleMessage(buildRpcMessage("inference.probe", {}));

    expect(createInferenceWorker).toHaveBeenCalledTimes(1);
  });
});

/** A session recorded as active, following group 42. */
const activeSession: StoredSession = {
  id: "session-1",
  title: "E-bike motors",
  groupId: 42,
  formerGroupIds: [],
  status: "active",
  createdAt: 1,
  updatedAt: 1,
};

/** A background over an empty database, so one test's session cannot leak into the next. */
const createSessionApp = async (overrides: Partial<BackgroundDependencies> = {}) => {
  const database = await createFreshDatabase();
  const app = createBackgroundApp(
    buildDependencies({ openDatabase: () => Promise.resolve(database), ...overrides }),
  );

  return { app, database };
};

describe("a research session through the background", () => {
  it("starts a session as a titled tab group, answering with the colour Firefox assigned", async () => {
    const { app, database } = await createSessionApp();

    const response = await app.handleMessage(
      buildRpcMessage("tabGroup.create", { title: "  E-bike motors  " }),
    );

    expect(response).toMatchObject({
      type: "tabGroup.created",
      payload: { groupId: 42, tabId: 7, title: "E-bike motors", color: "blue" },
    });
    expect(await database.getFromIndex(SESSION_STORE, "status", "active")).toMatchObject({
      title: "E-bike motors",
      groupId: 42,
      formerGroupIds: [],
    });
  });

  it("asks for persistent storage once a session has started", async () => {
    const persistStorage = vi.fn(() => Promise.resolve(false));
    const { app } = await createSessionApp({ persistStorage });

    const response = await app.handleMessage(buildRpcMessage("tabGroup.create", { title: "A" }));

    expect(response).toMatchObject({ type: "tabGroup.created" });
    expect(persistStorage).toHaveBeenCalledTimes(1);
  });

  it("still answers a start when the browser refuses persistent storage", async () => {
    const { app } = await createSessionApp({
      persistStorage: () => Promise.reject(new Error("not allowed")),
    });

    const response = await app.handleMessage(buildRpcMessage("tabGroup.create", { title: "A" }));

    expect(response).toMatchObject({ type: "tabGroup.created" });
  });

  it("answers a tab group the browser refused as a failure, not a protocol error", async () => {
    const tabGroups = createStubTabGroups({
      groupTabs: vi.fn().mockRejectedValue(new Error("tabs.group is not allowed")),
    });
    const { app, database } = await createSessionApp({ tabGroups });

    const response = await app.handleMessage(
      buildRpcMessage("tabGroup.create", { title: "Motors" }),
    );

    expect(response).toMatchObject({
      type: "tabGroup.failed",
      payload: { reason: "tabs.group is not allowed" },
    });
    expect(tabGroups.removeTab).toHaveBeenCalledWith(7);
    expect(await database.count(SESSION_STORE)).toBe(0);
  });

  it("starts a second session beside the active one, and views it", async () => {
    const tabGroups = createStubTabGroups({ groupTabs: vi.fn().mockResolvedValue(43) });
    const { app, database } = await createSessionApp({ tabGroups });
    await database.put(SESSION_STORE, activeSession);

    const response = await app.handleMessage(
      buildRpcMessage("tabGroup.create", { title: "Batteries" }),
    );

    expect(response).toMatchObject({ type: "tabGroup.created", payload: { groupId: 43 } });
    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({ status: "active" });
    expect(await database.countFromIndex(SESSION_STORE, "status", "active")).toBe(2);

    const answer = await app.handleMessage(buildRpcMessage("session.getActive", {}));

    expect(answer).toMatchObject({
      type: "session.active",
      payload: { sessions: [{ id: "session-1" }, { title: "Batteries" }] },
    });
    expect((answer.payload as { viewedId: string }).viewedId).not.toBe("session-1");
  });

  it("refuses a blank session title before any tab is opened", async () => {
    const tabGroups = createStubTabGroups();
    const { app } = await createSessionApp({ tabGroups });

    const response = await app.handleMessage(buildRpcMessage("tabGroup.create", { title: "   " }));

    expect(response).toMatchObject({
      type: "rpc.refused",
      payload: { rejection: "invalid-payload" },
    });
    expect(tabGroups.createTab).not.toHaveBeenCalled();
  });

  it("reports the active session, and none once its group has gone", async () => {
    const getGroup = vi
      .fn<TabGroupApi["getGroup"]>()
      .mockResolvedValueOnce({ color: "blue", title: "E-bike motors" })
      .mockRejectedValue(new Error("No group with id: 42"));
    const { app, database } = await createSessionApp({
      tabGroups: createStubTabGroups({ getGroup }),
    });
    await database.put(SESSION_STORE, activeSession);

    expect(await app.handleMessage(buildRpcMessage("session.getActive", {}))).toMatchObject({
      type: "session.active",
      payload: {
        sessions: [{ id: "session-1", title: "E-bike motors", groupId: 42, pageCount: 0 }],
        viewedId: "session-1",
      },
    });
    expect(await app.handleMessage(buildRpcMessage("session.getActive", {}))).toMatchObject({
      type: "session.active",
      payload: { sessions: [], viewedId: null },
    });
  });

  it("closes, rather than ends, the session when its group is removed", async () => {
    const { app, database } = await createSessionApp();
    await database.put(SESSION_STORE, activeSession);

    await app.handleGroupRemoved({ id: 42 });

    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({
      status: "closed",
      groupId: 42,
    });
  });

  it("reopens a closed session when its group is restored under the same id", async () => {
    const { app, database } = await createSessionApp();
    await database.put(SESSION_STORE, { ...activeSession, status: "closed" });

    await app.handleGroupCreated({ id: 42, title: "E-bike motors" });

    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({ status: "active" });
  });

  it("marks the first tab of a session it starts", async () => {
    const sessionTabs = createStubSessionTabs();
    const { app, database } = await createSessionApp({ sessionTabs });

    await app.handleMessage(buildRpcMessage("tabGroup.create", { title: "E-bike motors" }));

    const session = await database.getFromIndex(SESSION_STORE, "status", "active");
    await vi.waitFor(() => {
      expect(sessionTabs.values.get(`7:${SESSION_TAB_VALUE_KEY}`)).toBe(session?.id);
    });
  });

  it("marks tabs that join the group, and unmarks tabs that leave it", async () => {
    const sessionTabs = createStubSessionTabs();
    const { app, database } = await createSessionApp({ sessionTabs });
    await database.put(SESSION_STORE, activeSession);

    await app.handleTabCreated({ id: 8, groupId: 42 });
    await app.handleTabGroupChanged({ id: 9, groupId: 42 });
    expect(sessionTabs.values.get(`8:${SESSION_TAB_VALUE_KEY}`)).toBe("session-1");
    expect(sessionTabs.values.get(`9:${SESSION_TAB_VALUE_KEY}`)).toBe("session-1");

    await app.handleTabGroupChanged({ id: 9, groupId: -1 });
    expect(sessionTabs.values.has(`9:${SESSION_TAB_VALUE_KEY}`)).toBe(false);
  });

  it("brings session tabs restored after the group is gone into one new group, titled after the session", async () => {
    const sessionTabs = createStubSessionTabs([]);
    const { app, database } = await createSessionApp({ sessionTabs });
    await database.put(SESSION_STORE, { ...activeSession, status: "closed" });
    sessionTabs.values.set(`8:${SESSION_TAB_VALUE_KEY}`, "session-1");
    sessionTabs.values.set(`9:${SESSION_TAB_VALUE_KEY}`, "session-1");

    // Restored together, as "reopen all closed tabs" would: unordered they
    // would each find no group and create one.
    await Promise.all([
      app.handleTabCreated({ id: 8, groupId: -1 }),
      app.handleTabCreated({ id: 9, groupId: -1 }),
    ]);

    expect(sessionTabs.groupTabs).toHaveBeenNthCalledWith(1, { tabIds: [8] });
    expect(sessionTabs.groupTabs).toHaveBeenNthCalledWith(2, { tabIds: [9], groupId: 101 });
    expect(sessionTabs.updateGroup).toHaveBeenCalledWith(101, { title: "E-bike motors" });
    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({
      status: "active",
      groupId: 101,
      formerGroupIds: [42],
    });
  });

  it("lists a session whose group is gone with the saved ones, not the active", async () => {
    const { app, database } = await createSessionApp({
      tabGroups: createStubTabGroups({
        getGroup: vi.fn().mockRejectedValue(new Error("No group with id: 42")),
      }),
    });
    await database.put(SESSION_STORE, { ...activeSession, status: "closed" });

    expect(await app.handleMessage(buildRpcMessage("session.getActive", {}))).toMatchObject({
      type: "session.active",
      payload: { sessions: [], viewedId: null },
    });
    expect(await app.handleMessage(buildRpcMessage("library.list", {}))).toMatchObject({
      payload: { sessions: [{ id: "session-1", title: "E-bike motors" }] },
    });
  });

  it("renames the session with its group", async () => {
    const { app, database } = await createSessionApp();
    await database.put(SESSION_STORE, activeSession);

    await app.handleGroupUpdated({ id: 42, title: "Mid-drive motors" });

    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({
      title: "Mid-drive motors",
    });
  });

  it("closes a session whose group did not come back after a restart", async () => {
    const { app, database } = await createSessionApp({
      tabGroups: createStubTabGroups({
        getGroup: vi.fn().mockRejectedValue(new Error("No group with id: 42")),
      }),
    });
    await database.put(SESSION_STORE, activeSession);

    await app.reconcileSession();

    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({ status: "closed" });
  });
});

/** A non-private tab of the session's group (42), showing `url`. */
const sessionTab = (overrides: Partial<CaptureTab> = {}): CaptureTab => ({
  id: 7,
  url: "https://example.org/a",
  title: "A",
  groupId: 42,
  incognito: false,
  ...overrides,
});

/** Tab lookups that report `tabs` by id. */
const createTabCapture = (...tabs: CaptureTab[]): TabCaptureApi => ({
  getTab: vi.fn(async (tabId: number) => {
    const tab = tabs.find((candidate) => candidate.id === tabId);

    if (tab === undefined) {
      throw new Error(`Invalid tab ID: ${tabId}`);
    }

    return tab;
  }),
  queryGroupTabs: vi.fn(async () => tabs),
});

const commit = (url: string) => ({ tabId: 7, frameId: 0, url, transitionType: "link" });

describe("capturing the session's tabs through the background", () => {
  it("records pages committed in a session tab and counts them for the popup", async () => {
    const { app, database } = await createSessionApp({
      tabCapture: createTabCapture(sessionTab({ url: "https://example.org/b" })),
      tabGroups: createStubTabGroups({
        getGroup: vi.fn().mockResolvedValue({ color: "blue", title: "E-bike motors" }),
      }),
    });
    await database.put(SESSION_STORE, activeSession);

    await app.handleNavigationCommitted(commit("https://example.org/a"));
    await app.handleNavigationCommitted(commit("https://example.org/b"));

    expect(await database.count(NODE_STORE)).toBe(2);
    expect(await database.count(EDGE_STORE)).toBe(1);
    expect(await app.handleMessage(buildRpcMessage("session.getActive", {}))).toMatchObject({
      payload: { sessions: [{ pageCount: 2 }] },
    });
  });

  it("writes a title only after the commit it arrived behind", async () => {
    const { app, database } = await createSessionApp({
      tabCapture: createTabCapture(sessionTab({ url: "https://example.org/old", title: "Old" })),
    });
    await database.put(SESSION_STORE, activeSession);

    // Not awaited one by one: the browser fires both before either is handled.
    await Promise.all([
      app.handleNavigationCommitted(commit("https://example.org/a")),
      app.handleTabUpdated(sessionTab(), { title: "Mid-drive motors" }),
    ]);

    expect(await database.getAll(NODE_STORE)).toEqual([
      expect.objectContaining({ title: "Mid-drive motors" }),
    ]);
  });

  it("reports a failed capture and goes on with the next event", async () => {
    const reportError = vi.fn();
    const { app, database } = await createSessionApp({
      tabCapture: createTabCapture(sessionTab()),
      reportError,
    });
    await database.put(SESSION_STORE, activeSession);

    await app.handleNavigationCommitted({ ...commit("https://example.org/x"), tabId: 99 });
    await app.handleNavigationCommitted(commit("https://example.org/a"));

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid tab ID: 99" }),
    );
    expect(await database.count(NODE_STORE)).toBe(1);
  });

  it("follows a tab into and out of the group", async () => {
    const { app, database } = await createSessionApp();
    await database.put(SESSION_STORE, activeSession);

    await app.handleTabUpdated(sessionTab(), { groupId: 42 });
    await app.handleTabUpdated(sessionTab({ groupId: -1 }), { groupId: -1 });

    expect(await database.getAll(NODE_STORE)).toEqual([
      expect.objectContaining({ transitionType: "joined", tabState: "closed" }),
    ]);
  });

  it("counts a switch to a session tab", async () => {
    const { app, database } = await createSessionApp();
    await database.put(SESSION_STORE, activeSession);
    await app.handleTabUpdated(sessionTab(), { groupId: 42 });

    await app.handleTabActivated(7);

    expect(await database.getAll(NODE_STORE)).toEqual([
      expect.objectContaining({ signals: expect.objectContaining({ focusCount: 1 }) }),
    ]);
  });

  it("closes a closed tab's node, but not when its window is closing", async () => {
    const { app, database } = await createSessionApp();
    await database.put(SESSION_STORE, activeSession);
    await app.handleTabUpdated(sessionTab(), { groupId: 42 });

    await app.handleTabRemoved(7, { isWindowClosing: true });

    expect(await database.getAll(NODE_STORE)).toEqual([
      expect.objectContaining({ tabState: "open" }),
    ]);

    await app.handleTabRemoved(7, { isWindowClosing: false });

    expect(await database.getAll(NODE_STORE)).toEqual([
      expect.objectContaining({ tabState: "closed" }),
    ]);
  });

  it("reconciles the session's tabs after a restart", async () => {
    const { app, database } = await createSessionApp({
      tabCapture: createTabCapture(sessionTab({ id: 12, url: "https://example.org/a" })),
      tabGroups: createStubTabGroups({
        getGroup: vi.fn().mockResolvedValue({ color: "blue", title: "E-bike motors" }),
      }),
    });
    await database.put(SESSION_STORE, activeSession);
    await app.handleTabUpdated(sessionTab(), { groupId: 42 });

    await app.reconcileSession();

    const nodes = await database.getAll(NODE_STORE);

    expect(nodes.filter((node) => node.tabState === "open")).toEqual([
      expect.objectContaining({ tabId: 12, transitionType: "restored" }),
    ]);
  });

  it("records a session tab that came back from the page it shows", async () => {
    const sessionTabs = createStubSessionTabs();
    const { app, database } = await createSessionApp({
      sessionTabs,
      tabCapture: createTabCapture(sessionTab({ id: 12, url: "https://example.org/a" })),
    });
    await database.put(SESSION_STORE, activeSession);
    sessionTabs.values.set(`12:${SESSION_TAB_VALUE_KEY}`, "session-1");

    // Restored discarded, so no commit will follow until it is shown.
    await app.handleTabCreated({ id: 12, groupId: 42 });

    expect(await database.getAll(NODE_STORE)).toEqual([
      expect.objectContaining({ tabId: 12, url: "https://example.org/a", tabState: "open" }),
    ]);
  });

  it("leaves a tab newly opened in the group to its first commit", async () => {
    const { app, database } = await createSessionApp({
      tabCapture: createTabCapture(sessionTab({ id: 12, url: "https://example.org/a" })),
    });
    await database.put(SESSION_STORE, activeSession);

    await app.handleTabCreated({ id: 12, groupId: 42 });

    expect(await database.count(NODE_STORE)).toBe(0);
  });

  it("closes the nodes of tabs left behind when the session's group comes back", async () => {
    const { app, database } = await createSessionApp({ tabCapture: createTabCapture() });
    await database.put(SESSION_STORE, activeSession);
    await app.handleTabUpdated(sessionTab(), { groupId: 42 });
    await database.put(SESSION_STORE, { ...activeSession, status: "closed" });

    // The group's tabs return under new ids, so tab 7's node stays behind.
    await app.handleGroupCreated({ id: 42, title: "E-bike motors" });

    expect(await database.getAll(NODE_STORE)).toEqual([
      expect.objectContaining({ tabId: 7, tabState: "closed" }),
    ]);
  });
});

/** The graph snapshots a port has received so far, oldest first. */
const readSnapshots = (posted: unknown[]) =>
  posted.filter((message) => (message as { type: string }).type === "graph.snapshot") as {
    payload: { session: { title: string } | null; nodes: { tabState: string }[] };
  }[];

/** A background with an active session and one map page subscribed over a port. */
const createSubscribedApp = async (overrides: Partial<BackgroundDependencies> = {}) => {
  const { app, database } = await createSessionApp({
    tabCapture: createTabCapture(sessionTab({ url: "https://example.org/b" })),
    ...overrides,
  });
  await database.put(SESSION_STORE, activeSession);

  const map = createFakePort();

  app.attachPort(map.port);
  map.send(buildRpcMessage("graph.subscribe", {}));
  await vi.waitFor(() => expect(readSnapshots(map.posted)).toHaveLength(1));

  return { app, database, map };
};

describe("several sessions through the background", () => {
  const second = { ...activeSession, id: "session-2", title: "Batteries", groupId: 43 };

  /** Two active sessions, each with one tab in its own group. */
  const createTwoSessionsApp = async (overrides: Partial<BackgroundDependencies> = {}) => {
    const tabCapture = createTabCapture(
      sessionTab(),
      sessionTab({ id: 8, groupId: 43, url: "https://example.org/b" }),
    );
    const { app, database } = await createSessionApp({ tabCapture, ...overrides });

    await database.put(SESSION_STORE, activeSession);
    await database.put(SESSION_STORE, second);

    return { app, database };
  };

  it("records each tab into the session of its group, leaving the other graph alone", async () => {
    const { app, database } = await createTwoSessionsApp();

    await app.handleNavigationCommitted(commit("https://example.org/a"));
    await app.handleNavigationCommitted({ ...commit("https://example.org/b"), tabId: 8 });

    const nodes = await database.getAll(NODE_STORE);

    expect(nodes.map(({ sessionId, tabId }) => [sessionId, tabId]).toSorted()).toEqual([
      ["session-1", 7],
      ["session-2", 8],
    ]);
  });

  it("views the session it is asked to, closing and ending nothing", async () => {
    const { app, database } = await createTwoSessionsApp();

    const response = await app.handleMessage(
      buildRpcMessage("session.view", { sessionId: "session-2" }),
    );

    expect(response).toMatchObject({ type: "session.viewed", payload: { viewedId: "session-2" } });
    expect(await app.handleMessage(buildRpcMessage("session.getActive", {}))).toMatchObject({
      payload: { sessions: [{ id: "session-1" }, { id: "session-2" }], viewedId: "session-2" },
    });
    expect(await database.countFromIndex(SESSION_STORE, "status", "active")).toBe(2);
  });

  it("keeps the viewed session when the popup is opened again", async () => {
    const { app } = await createTwoSessionsApp();

    await app.handleMessage(buildRpcMessage("session.view", { sessionId: "session-2" }));
    await app.handleMessage(buildRpcMessage("session.getActive", {}));

    expect(await app.handleMessage(buildRpcMessage("session.getActive", {}))).toMatchObject({
      payload: { viewedId: "session-2" },
    });
  });

  it("pushes each map page only the graph of its own session", async () => {
    const { app } = await createTwoSessionsApp();
    const first = createFakePort();
    const other = createFakePort();

    app.attachPort(first.port);
    app.attachPort(other.port);
    first.send(buildRpcMessage("graph.subscribe", { sessionId: "session-1" }));
    other.send(buildRpcMessage("graph.subscribe", { sessionId: "session-2" }));
    await vi.waitFor(() => expect(readSnapshots(first.posted)).toHaveLength(1));
    await vi.waitFor(() => expect(readSnapshots(other.posted)).toHaveLength(1));

    await app.handleNavigationCommitted({ ...commit("https://example.org/b"), tabId: 8 });
    await vi.waitFor(() =>
      expect(readSnapshots(other.posted).at(-1)?.payload.nodes).toHaveLength(1),
    );

    expect(readSnapshots(first.posted).at(-1)?.payload.session).toMatchObject({ id: "session-1" });
    expect(readSnapshots(first.posted).at(-1)?.payload.nodes).toHaveLength(0);
    expect(readSnapshots(other.posted).at(-1)?.payload.session).toMatchObject({ id: "session-2" });
  });
});

describe("the research map through the background", () => {
  it("answers a subscription with the active session's graph", async () => {
    const { app, map } = await createSubscribedApp();

    await app.handleNavigationCommitted(commit("https://example.org/a"));
    await vi.waitFor(() => expect(readSnapshots(map.posted)).toHaveLength(2));

    expect(readSnapshots(map.posted)[0]?.payload).toEqual({
      session: { id: "session-1", title: "E-bike motors" },
      nodes: [],
      edges: [],
      clusters: [],
      activity: [],
    });
  });

  it("pushes a snapshot that already holds the write that caused it", async () => {
    const { app, map } = await createSubscribedApp();

    await app.handleNavigationCommitted(commit("https://example.org/a"));
    await app.handleNavigationCommitted(commit("https://example.org/b"));
    // Nodes come in key order, which is a random UUID's, not the order of capture.
    await vi.waitFor(() =>
      expect(
        readSnapshots(map.posted)
          .at(-1)
          ?.payload.nodes.map((node) => node.tabState)
          .toSorted(),
      ).toEqual(["closed", "open"]),
    );
  });

  it("pushes a refined search together with its refinement edge", async () => {
    const second = "https://www.bing.com/search?q=e-bike+mid-drive+motors";
    const { app, database, map } = await createSubscribedApp({
      tabCapture: createTabCapture(sessionTab({ url: second })),
    });

    // Back to back, as a user searching twice in one tab produces them.
    await Promise.all([
      app.handleNavigationCommitted(commit("https://duckduckgo.com/?q=e-bike+motors")),
      app.handleNavigationCommitted(commit(second)),
    ]);

    const edges = await database.getAll(EDGE_STORE);

    expect(edges.filter((edge) => edge.kind === "refinement")).toHaveLength(1);
    await vi.waitFor(() => {
      const last = readSnapshots(map.posted).at(-1) as unknown as {
        payload: { edges: { kind: string }[] };
      };

      expect(last.payload.edges.map((edge) => edge.kind).toSorted()).toEqual([
        "refinement",
        "sameTab",
      ]);
    });
  });

  it("coalesces a burst of events into at most two pushes", async () => {
    const { app, map } = await createSubscribedApp();

    // The browser reports a commit, its title and the focus within milliseconds.
    await Promise.all([
      app.handleNavigationCommitted(commit("https://example.org/a")),
      app.handleTabUpdated(sessionTab(), { title: "Mid-drive motors" }),
      app.handleTabActivated(7),
    ]);
    await vi.waitFor(() => expect(readSnapshots(map.posted).at(-1)?.payload.nodes).toHaveLength(1));

    expect(readSnapshots(map.posted).length - 1).toBeLessThanOrEqual(2);
  });

  it("pushes no session once the session's group is removed", async () => {
    const { app, map } = await createSubscribedApp();

    await app.handleGroupRemoved({ id: 42 });
    await vi.waitFor(() => expect(readSnapshots(map.posted)).toHaveLength(2));

    expect(readSnapshots(map.posted)[1]?.payload).toEqual({
      session: null,
      nodes: [],
      edges: [],
      clusters: [],
      activity: [],
    });
  });

  it("pushes a rename of the session", async () => {
    const { app, map } = await createSubscribedApp();

    await app.handleGroupUpdated({ id: 42, title: "Hub motors" });
    await vi.waitFor(() => expect(readSnapshots(map.posted)).toHaveLength(2));

    expect(readSnapshots(map.posted)[1]?.payload.session).toMatchObject({ title: "Hub motors" });
  });

  it("stops pushing to a map page that has gone", async () => {
    const { app, map } = await createSubscribedApp();

    map.disconnect();
    await app.handleNavigationCommitted(commit("https://example.org/a"));

    expect(readSnapshots(map.posted)).toHaveLength(1);
  });

  it("reads nothing for a push when no map page is listening", async () => {
    const { app, database } = await createSessionApp({
      tabCapture: createTabCapture(sessionTab()),
    });
    await database.put(SESSION_STORE, activeSession);
    const getAllFromIndex = vi.spyOn(database, "getAllFromIndex");

    await app.handleNavigationCommitted(commit("https://example.org/a"));

    // Capture itself looks up the tab's node; reading the whole graph would
    // also read the session's edges.
    expect(getAllFromIndex).not.toHaveBeenCalledWith(EDGE_STORE, "sessionId", "session-1");
  });

  it("drops a map page whose port can no longer be posted to", async () => {
    const { app, map } = await createSubscribedApp();
    const failing = createFakePort();

    failing.port.postMessage = () => {
      throw new Error("Attempt to postMessage on disconnected port");
    };
    // Subscribed after the throw is armed, the answer is lost too; only the
    // working map page should still receive pushes.
    app.attachPort(failing.port);
    failing.send(buildRpcMessage("graph.subscribe", {}));

    await app.handleNavigationCommitted(commit("https://example.org/a"));
    await app.handleNavigationCommitted(commit("https://example.org/b"));
    await vi.waitFor(() => expect(readSnapshots(map.posted).at(-1)?.payload.nodes).toHaveLength(2));
  });

  it("selects the tab of an open node", async () => {
    const focusTab = vi.fn(() => Promise.resolve());
    const { app, database } = await createSessionApp({ focusTab });
    await database.put(SESSION_STORE, activeSession);
    await app.handleTabUpdated(sessionTab(), { groupId: 42 });

    const response = await app.handleMessage(buildRpcMessage("tab.focus", { tabId: 7 }));

    expect(response).toMatchObject({ type: "tab.focused", payload: { tabId: 7 } });
    expect(focusTab).toHaveBeenCalledWith(7);
  });

  it("refuses to select a tab whose node is closed", async () => {
    const focusTab = vi.fn(() => Promise.resolve());
    const { app, database } = await createSessionApp({ focusTab });
    await database.put(SESSION_STORE, activeSession);
    await app.handleTabUpdated(sessionTab(), { groupId: 42 });
    await app.handleTabRemoved(7, { isWindowClosing: false });

    const response = await app.handleMessage(buildRpcMessage("tab.focus", { tabId: 7 }));

    expect(response).toMatchObject({ type: "tab.focusRefused", payload: { tabId: 7 } });
    expect(focusTab).not.toHaveBeenCalled();
  });

  it("refuses to select a tab outside the session", async () => {
    const focusTab = vi.fn(() => Promise.resolve());
    const { app, database } = await createSessionApp({ focusTab });
    await database.put(SESSION_STORE, activeSession);

    const response = await app.handleMessage(buildRpcMessage("tab.focus", { tabId: 99 }));

    expect(response).toMatchObject({ type: "tab.focusRefused" });
    expect(focusTab).not.toHaveBeenCalled();
  });

  it("refuses to select a tab when no session is active", async () => {
    const focusTab = vi.fn(() => Promise.resolve());
    const { app } = await createSessionApp({ focusTab });

    const response = await app.handleMessage(buildRpcMessage("tab.focus", { tabId: 7 }));

    expect(response).toMatchObject({ type: "tab.focusRefused" });
    expect(focusTab).not.toHaveBeenCalled();
  });

  it("answers a tab the browser could not select as refused", async () => {
    const { app, database } = await createSessionApp({
      focusTab: () => Promise.reject(new Error("Invalid tab ID: 7")),
    });
    await database.put(SESSION_STORE, activeSession);
    await app.handleTabUpdated(sessionTab(), { groupId: 42 });

    const response = await app.handleMessage(buildRpcMessage("tab.focus", { tabId: 7 }));

    expect(response).toMatchObject({
      type: "tab.focusRefused",
      payload: { reason: "Invalid tab ID: 7" },
    });
  });

  it("opens the map for the viewed session when asked", async () => {
    const openMap = vi.fn(() => Promise.resolve());
    const { app, database } = await createSessionApp({ openMap });
    await database.put(SESSION_STORE, activeSession);

    const response = await app.handleMessage(buildRpcMessage("map.open", {}));

    expect(response).toMatchObject({ type: "map.opened" });
    expect(openMap).toHaveBeenCalledWith("session-1");
  });

  it("opens the map for the session it is asked for, not the viewed one", async () => {
    const openMap = vi.fn(() => Promise.resolve());
    const { app, database } = await createSessionApp({ openMap });
    await database.put(SESSION_STORE, activeSession);
    await database.put(SESSION_STORE, {
      ...activeSession,
      id: "session-2",
      groupId: 43,
      viewedAt: 99,
    });

    await app.handleMessage(buildRpcMessage("map.open", { sessionId: "session-1" }));

    expect(openMap).toHaveBeenCalledWith("session-1");
  });
});

/** A batch as a session page's observer sends it. */
const batch = (maxScroll: number, copyEvents = 0) =>
  buildRpcMessage("signal.batch", { maxScroll, copyEvents, pasteEvents: 0 });

const FROM_PAGE_A = { tabId: 7, url: "https://example.org/a" };

/**
 * A background with an active session, a clock the test moves, and focus the
 * test decides, recording which tabs it injected and asked for text.
 */
const createSignalsApp = async (overrides: Partial<BackgroundDependencies> = {}) => {
  const clock = { now: 1_000, focusedTabId: undefined as number | undefined };
  const executeScript = vi.fn((_injection: unknown) => Promise.resolve([]));
  const requestPageText = vi.fn((_tabId: number) => Promise.resolve(undefined));
  const requestFlush = vi.fn((_tabId: number) => Promise.resolve(undefined));
  const requestNotice = vi.fn(
    (_tabId: number, _sessionTitle: string, _kind?: "added" | "blocked") =>
      Promise.resolve(undefined),
  );
  const { app, database } = await createSessionApp({
    tabCapture: createTabCapture(sessionTab(), sessionTab({ id: 8, url: "https://example.org/c" })),
    pageSignals: { executeScript, requestPageText, requestFlush, requestNotice },
    readFocusedTab: () => Promise.resolve(clock.focusedTabId),
    now: () => clock.now,
    ...overrides,
  });

  await database.put(SESSION_STORE, activeSession);

  return { app, database, clock, executeScript, requestPageText, requestFlush, requestNotice };
};

const readNodeByUrl = async (
  database: Awaited<ReturnType<typeof createFreshDatabase>>,
  url: string,
) => (await database.getAll(NODE_STORE)).find((node) => node.url === url);

/** A visible page saying it may be being read. */
const tick = () => buildRpcMessage("signal.tick", {});

/** A page's report of what it says about itself. */
const pageMetadata = (title: string) =>
  buildRpcMessage("page.metadata", { title, description: "How they work." });

/** Opens a page in the session and makes it deep read with a copy. */
const deepRead = async (app: Awaited<ReturnType<typeof createSignalsApp>>["app"]) => {
  await app.handleNavigationCommitted(commit("https://example.org/a"));
  await app.handleContentMessage(batch(0.3, 1), FROM_PAGE_A);
};

describe("page signals and reading time through the background", () => {
  it("observes a page committed in a session tab, and none outside the group", async () => {
    const { app, executeScript } = await createSignalsApp({
      tabCapture: createTabCapture(sessionTab(), sessionTab({ id: 9, groupId: 5 })),
    });

    await app.handleNavigationCommitted(commit("https://example.org/a"));
    await app.handleNavigationCommitted({ ...commit("https://example.org/a"), tabId: 9 });

    expect(executeScript).toHaveBeenCalledTimes(1);
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 7, frameIds: [0] },
      files: ["/content-scripts/pageObserver.js"],
    });
  });

  describe("the notice that a page was added to research", () => {
    it("is requested once the page's text is stored, naming the session", async () => {
      const { app, requestNotice } = await createSignalsApp();

      await deepRead(app);

      expect(requestNotice).not.toHaveBeenCalled();

      await app.handleContentMessage(extracted("Mid-drive motors."), FROM_PAGE_A);

      expect(requestNotice).toHaveBeenCalledWith(7, "E-bike motors");
    });

    it("is not requested for text from a page the tab has left", async () => {
      const { app, requestNotice } = await createSignalsApp();

      await app.handleNavigationCommitted(commit("https://example.org/a"));
      await app.handleNavigationCommitted(commit("https://example.org/b"));
      await app.handleContentMessage(extracted("Old page"), FROM_PAGE_A);

      expect(requestNotice).not.toHaveBeenCalled();
    });

    it("is not requested once the user turned it off", async () => {
      const { app, requestNotice } = await createSignalsApp();

      await app.handleMessage(buildRpcMessage("pageNotice.set", { isEnabled: false }));
      await deepRead(app);
      await app.handleContentMessage(extracted("Mid-drive motors."), FROM_PAGE_A);

      expect(requestNotice).not.toHaveBeenCalled();
    });

    it("does not hold the text back when the page refuses the notice", async () => {
      const { app, database, requestNotice } = await createSignalsApp();

      requestNotice.mockRejectedValue(new Error("No receiver."));
      await deepRead(app);

      expect(
        await app.handleContentMessage(extracted("Mid-drive motors."), FROM_PAGE_A),
      ).toMatchObject({
        type: "content.stored",
      });
      expect(await database.count(SNAPSHOT_STORE)).toBe(1);
    });
  });

  describe("the notice that a site is not tracked", () => {
    const BANK = "https://www.paypal.com/myaccount";
    const noticeInjection = {
      target: { tabId: 7, frameIds: [0] },
      files: ["/content-scripts/blockedNotice.js"],
    };

    it("is shown for a denylisted page in a session tab, naming the session, and records nothing", async () => {
      const { app, database, executeScript, requestNotice } = await createSignalsApp();

      await app.handleNavigationCommitted(commit(BANK));

      expect(executeScript).toHaveBeenCalledTimes(1);
      expect(executeScript).toHaveBeenCalledWith(noticeInjection);
      expect(requestNotice).toHaveBeenCalledWith(7, "E-bike motors", "blocked");
      expect(await database.count(NODE_STORE)).toBe(0);
      expect(await database.count(SNAPSHOT_STORE)).toBe(0);
    });

    it("is shown for a site the user added", async () => {
      const { app, requestNotice } = await createSignalsApp();

      await app.handleMessage(buildRpcMessage("denylist.save", { sites: ["myclinic.example"] }));
      await app.handleNavigationCommitted(commit("https://portal.myclinic.example/"));

      expect(requestNotice).toHaveBeenCalledWith(7, "E-bike motors", "blocked");
    });

    it("is shown once for a site in a session, and again for another site", async () => {
      const { app, requestNotice } = await createSignalsApp();

      await app.handleNavigationCommitted(commit(BANK));
      await app.handleNavigationCommitted(commit("https://www.paypal.com/activity"));
      await app.handleNavigationCommitted(commit("https://mail.google.com/mail/u/0/"));

      expect(requestNotice).toHaveBeenCalledTimes(2);
    });

    it("is not shown for an ordinary page, a page that is not a web page or a tab outside a session", async () => {
      const { app, requestNotice } = await createSignalsApp({
        tabCapture: createTabCapture(sessionTab(), sessionTab({ id: 9, groupId: 5 })),
      });

      await app.handleNavigationCommitted(commit("https://example.org/a"));
      await app.handleNavigationCommitted(commit("about:preferences"));
      await app.handleNavigationCommitted({ ...commit(BANK), tabId: 9 });

      expect(requestNotice).not.toHaveBeenCalled();
    });

    it("is not shown, and nothing is injected, once the user turned the notice off", async () => {
      const { app, executeScript, requestNotice } = await createSignalsApp();

      await app.handleMessage(buildRpcMessage("pageNotice.set", { isEnabled: false }));
      await app.handleNavigationCommitted(commit(BANK));

      expect(executeScript).not.toHaveBeenCalled();
      expect(requestNotice).not.toHaveBeenCalled();
    });

    it("asks for nothing when the page may not be scripted", async () => {
      const { app, executeScript, requestNotice } = await createSignalsApp();

      executeScript.mockRejectedValue(new Error("Missing host permission"));
      await app.handleNavigationCommitted(commit(BANK));

      expect(requestNotice).not.toHaveBeenCalled();
    });

    it("keeps no record of the site, so a visit leaves nothing to read", async () => {
      const { app, database } = await createSignalsApp();

      await app.handleNavigationCommitted(commit(BANK));

      const everything = JSON.stringify(
        await Promise.all(
          database.objectStoreNames.length === 0
            ? []
            : [...database.objectStoreNames]
                .filter((name) => name !== "keys" && name !== "models" && name !== "modelFiles")
                .map(async (name) => database.getAll(name)),
        ),
      );

      expect(everything).not.toContain("paypal");
    });
  });

  it("records nothing on a site the user added, and refuses an entry that names no site", async () => {
    const { app, database, executeScript } = await createSignalsApp();

    expect(
      await app.handleMessage(
        buildRpcMessage("denylist.save", { sites: ["https://www.MyClinic.example/visits"] }),
      ),
    ).toMatchObject({ type: "denylist.view", payload: { sites: ["myclinic.example"] } });
    expect(
      await app.handleMessage(
        buildRpcMessage("denylist.save", { sites: ["myclinic.example", "not a site"] }),
      ),
    ).toMatchObject({ payload: { sites: ["myclinic.example"], invalid: "not a site" } });

    await app.handleNavigationCommitted(commit("https://portal.myclinic.example/"));

    expect(await database.count(NODE_STORE)).toBe(0);
    expect(executeScript).not.toHaveBeenCalledWith(
      expect.objectContaining({ files: ["/content-scripts/pageObserver.js"] }),
    );
    expect(await app.handleMessage(buildRpcMessage("denylist.read", {}))).toMatchObject({
      payload: { sites: ["myclinic.example"] },
    });
  });

  it("keeps the page notice on until the user turns it off, and remembers the choice", async () => {
    const { app } = await createSignalsApp();

    expect(await app.handleMessage(buildRpcMessage("pageNotice.read", {}))).toMatchObject({
      type: "pageNotice.status",
      payload: { isEnabled: true },
    });
    expect(
      await app.handleMessage(buildRpcMessage("pageNotice.set", { isEnabled: false })),
    ).toMatchObject({ payload: { isEnabled: false } });
    expect(await app.handleMessage(buildRpcMessage("pageNotice.read", {}))).toMatchObject({
      payload: { isEnabled: false },
    });
  });

  it("encrypts on start-up a snapshot an earlier version stored in the clear", async () => {
    const { app, database } = await createSignalsApp();

    await database.put(SNAPSHOT_STORE, {
      id: "legacy",
      sessionId: "session-1",
      nodeId: "node-1",
      contentHash: "hash",
      byteLength: 3,
      truncated: false,
      extractorVersion: "readability@0.6.0/1",
      capturedAt: 1,
      compressedText: new Uint8Array([
        31, 139, 8, 0, 0, 0, 0, 0, 0, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ]).buffer,
    } as never);

    await app.reconcileSession();

    expect(await database.get(SNAPSHOT_STORE, "legacy")).toMatchObject({
      contentHash: "hash",
      cipher: "aes-gcm-256",
    });
    expect(await database.get(SNAPSHOT_STORE, "legacy")).not.toHaveProperty("compressedText");
  });

  it("observes the session's open pages once page access is granted", async () => {
    const { app, executeScript } = await createSignalsApp();

    await app.handleNavigationCommitted(commit("https://example.org/a"));
    executeScript.mockClear();
    await app.handlePermissionsAdded();

    await vi.waitFor(() => expect(executeScript).toHaveBeenCalledTimes(1));
  });

  it("adds a batch to the page that sent it", async () => {
    const { app, database } = await createSignalsApp();

    await app.handleNavigationCommitted(commit("https://example.org/a"));

    expect(await app.handleContentMessage(batch(0.6, 1), FROM_PAGE_A)).toMatchObject({
      type: "signal.recorded",
    });
    expect((await readNodeByUrl(database, "https://example.org/a"))?.signals).toMatchObject({
      maxScroll: 0.6,
      copyEvents: 1,
    });
  });

  it("tells a page whose tab is not a session tab to stop", async () => {
    const { app } = await createSignalsApp();

    expect(
      await app.handleContentMessage(batch(0.6), { tabId: 99, url: "https://example.org/z" }),
    ).toMatchObject({ type: "signal.dropped", payload: { stop: true } });
  });

  it("refuses from a page anything but a page's own messages, and those from a surface", async () => {
    const { app } = await createSignalsApp();

    expect(
      await app.handleContentMessage(buildRpcMessage("session.getActive", {}), FROM_PAGE_A),
    ).toMatchObject({ type: "rpc.refused", payload: { rejection: "unknown-type" } });
    expect(await app.handleMessage(batch(0.6))).toMatchObject({
      type: "rpc.refused",
      payload: { rejection: "unknown-type" },
    });
  });

  it("records reading time on a page when the user switches away from it", async () => {
    const { app, database, clock } = await createSignalsApp();

    await app.handleNavigationCommitted(commit("https://example.org/a"));
    await app.handleNavigationCommitted({ ...commit("https://example.org/c"), tabId: 8 });
    clock.focusedTabId = 7;
    await app.handleTabActivated(7);
    clock.now += 30_000;
    clock.focusedTabId = 8;
    await app.handleTabActivated(8);

    expect((await readNodeByUrl(database, "https://example.org/a"))?.signals).toMatchObject({
      activeDwellMs: 30_000,
      focusCount: 1,
    });
  });

  it("stops counting when Firefox loses focus, and from when input stopped when idle", async () => {
    const { app, database, clock } = await createSignalsApp();

    await app.handleNavigationCommitted(commit("https://example.org/a"));
    clock.focusedTabId = 7;
    await app.handleTabActivated(7);
    clock.now += 10_000;
    clock.focusedTabId = undefined;
    await app.handleWindowFocusChanged();
    clock.now += 120_000;
    clock.focusedTabId = 7;
    await app.handleWindowFocusChanged();
    clock.now += 90_000;
    clock.focusedTabId = undefined;
    await app.handleIdleStateChanged("idle");

    // 10 s, then 30 s of the 90 s before idleness was reported 60 s late.
    expect((await readNodeByUrl(database, "https://example.org/a"))?.signals.activeDwellMs).toBe(
      40_000,
    );
  });

  it("asks a page for its text once a copy makes it deep read, and stores what it sends", async () => {
    const { app, database, clock, requestPageText } = await createSignalsApp();

    await app.handleNavigationCommitted(commit("https://example.org/a"));
    clock.focusedTabId = 7;
    await app.handleTabActivated(7);
    await app.handleContentMessage(batch(0.3), FROM_PAGE_A);

    expect(requestPageText).not.toHaveBeenCalled();

    await app.handleContentMessage(batch(0.3, 1), FROM_PAGE_A);

    expect(requestPageText).toHaveBeenCalledWith(7);

    expect(
      await app.handleContentMessage(
        buildRpcMessage("content.extracted", {
          text: "Mid-drive motors sit at the cranks.",
          truncated: false,
          extractorVersion: "readability@0.6.0/1",
        }),
        FROM_PAGE_A,
      ),
    ).toMatchObject({ type: "content.stored" });

    const node = await readNodeByUrl(database, "https://example.org/a");

    expect(await database.getAll(SNAPSHOT_STORE)).toEqual([
      expect.objectContaining({ nodeId: node?.id, contentHash: node?.contentHash }),
    ]);

    requestPageText.mockClear();
    await app.handleContentMessage(batch(0.5, 1), FROM_PAGE_A);

    expect(requestPageText).not.toHaveBeenCalled();
  });

  it("asks for a page's text when reading time alone makes it deep read", async () => {
    const { app, clock, requestPageText } = await createSignalsApp();

    await app.handleNavigationCommitted(commit("https://example.org/a"));
    await app.handleNavigationCommitted({ ...commit("https://example.org/c"), tabId: 8 });
    clock.focusedTabId = 7;
    await app.handleTabActivated(7);
    await app.handleContentMessage(batch(0.5), FROM_PAGE_A);
    clock.now += 50_000;
    clock.focusedTabId = 8;
    await app.handleTabActivated(8);

    expect(requestPageText).toHaveBeenCalledWith(7);
  });

  describe("a page saying it is still being read", () => {
    it("brings reading time up to date and asks for the text once it makes the page deep read", async () => {
      const { app, database, clock, requestPageText } = await createSignalsApp();

      await app.handleNavigationCommitted(commit("https://example.org/a"));
      clock.focusedTabId = 7;
      await app.handleTabActivated(7);
      // Scrolled through half of it at once; after that, nothing but reading.
      await app.handleContentMessage(batch(0.5), FROM_PAGE_A);
      clock.now += 20_000;

      expect(await app.handleContentMessage(tick(), FROM_PAGE_A)).toMatchObject({
        type: "signal.recorded",
      });
      expect(requestPageText).not.toHaveBeenCalled();

      clock.now += 15_000;
      await app.handleContentMessage(tick(), FROM_PAGE_A);

      expect((await readNodeByUrl(database, "https://example.org/a"))?.signals).toMatchObject({
        activeDwellMs: 35_000,
        maxScroll: 0.5,
      });
      expect(requestPageText).toHaveBeenCalledWith(7);
    });

    it("records no signal of its own", async () => {
      const { app, database, clock } = await createSignalsApp();

      await app.handleNavigationCommitted(commit("https://example.org/a"));
      clock.focusedTabId = 7;
      await app.handleTabActivated(7);
      await app.handleContentMessage(tick(), FROM_PAGE_A);

      expect((await readNodeByUrl(database, "https://example.org/a"))?.signals).toMatchObject({
        maxScroll: 0,
        copyEvents: 0,
        pasteEvents: 0,
      });
    });

    it("adds nothing while Firefox is not focused or the user is idle", async () => {
      const { app, database, clock } = await createSignalsApp();

      await app.handleNavigationCommitted(commit("https://example.org/a"));
      clock.focusedTabId = 7;
      await app.handleTabActivated(7);
      clock.now += 60_000;
      clock.focusedTabId = undefined;
      await app.handleContentMessage(tick(), FROM_PAGE_A);
      clock.now += 60_000;
      await app.handleContentMessage(tick(), FROM_PAGE_A);

      // Only the first minute, up to the tick that found the window unfocused.
      expect((await readNodeByUrl(database, "https://example.org/a"))?.signals.activeDwellMs).toBe(
        60_000,
      );
    });

    it("adds nothing for a page the tab has left, and is dropped", async () => {
      const { app, database, clock, requestPageText } = await createSignalsApp();

      await app.handleNavigationCommitted(commit("https://example.org/a"));
      await app.handleNavigationCommitted(commit("https://example.org/b"));
      clock.focusedTabId = 7;
      await app.handleTabActivated(7);
      clock.now += 60_000;

      expect(await app.handleContentMessage(tick(), FROM_PAGE_A)).toMatchObject({
        type: "signal.dropped",
      });
      expect((await readNodeByUrl(database, "https://example.org/a"))?.signals.activeDwellMs).toBe(
        0,
      );
      expect(requestPageText).not.toHaveBeenCalled();
    });

    it("tells a page in a tab outside the session to stop", async () => {
      const { app } = await createSignalsApp();

      expect(
        await app.handleContentMessage(tick(), { tabId: 99, url: "https://example.org/x" }),
      ).toMatchObject({ type: "signal.dropped", payload: { stop: true } });
    });
  });

  it("stores no text sent by a page its tab has left", async () => {
    const { app, database } = await createSignalsApp();

    await app.handleNavigationCommitted(commit("https://example.org/a"));
    await app.handleNavigationCommitted(commit("https://example.org/b"));

    expect(
      await app.handleContentMessage(
        buildRpcMessage("content.extracted", {
          text: "Old page",
          truncated: false,
          extractorVersion: "readability@0.6.0/1",
        }),
        FROM_PAGE_A,
      ),
    ).toMatchObject({ type: "signal.dropped", payload: { stop: false } });
    expect(await database.count(SNAPSHOT_STORE)).toBe(0);
  });

  describe("what a page says about itself", () => {
    it("is stored for the page the tab shows, at once and without a deep read", async () => {
      const { app, database } = await createSignalsApp();

      await app.handleNavigationCommitted(commit("https://example.org/a"));

      expect(
        await app.handleContentMessage(pageMetadata("Mid-drive motors"), FROM_PAGE_A),
      ).toMatchObject({ type: "metadata.stored" });

      const node = await readNodeByUrl(database, "https://example.org/a");

      expect(await database.get(PAGE_METADATA_STORE, node?.id ?? "")).toMatchObject({
        nodeId: node?.id,
        sessionId: "session-1",
        title: "Mid-drive motors",
      });
    });

    it("is dropped for a page its tab has left", async () => {
      const { app, database } = await createSignalsApp();

      await app.handleNavigationCommitted(commit("https://example.org/a"));
      await app.handleNavigationCommitted(commit("https://example.org/b"));

      expect(await app.handleContentMessage(pageMetadata("Old page"), FROM_PAGE_A)).toMatchObject({
        type: "signal.dropped",
        payload: { stop: false },
      });
      expect(await database.count(PAGE_METADATA_STORE)).toBe(0);
    });

    it("is dropped, and the page told to stop, for a tab outside every session", async () => {
      const { app, database } = await createSignalsApp({
        tabCapture: createTabCapture(sessionTab({ id: 9, groupId: 5 })),
      });

      expect(
        await app.handleContentMessage(pageMetadata("Elsewhere"), {
          tabId: 9,
          url: "https://example.org/z",
        }),
      ).toMatchObject({ type: "signal.dropped", payload: { stop: true } });
      expect(await database.count(PAGE_METADATA_STORE)).toBe(0);
    });

    it("is not stored for a denylisted page, which has no node", async () => {
      const { app, database } = await createSignalsApp();

      await app.handleMessage(buildRpcMessage("denylist.save", { sites: ["example.org"] }));
      await app.handleNavigationCommitted(commit("https://example.org/a"));

      expect(await app.handleContentMessage(pageMetadata("Private"), FROM_PAGE_A)).toMatchObject({
        type: "signal.dropped",
      });
      expect(await database.count(PAGE_METADATA_STORE)).toBe(0);
    });

    it("is refused when a field is past its limit", async () => {
      const { app, database } = await createSignalsApp();

      await app.handleNavigationCommitted(commit("https://example.org/a"));

      expect(
        await app.handleContentMessage(
          buildRpcMessage("page.metadata", { description: "x".repeat(1001) }),
          FROM_PAGE_A,
        ),
      ).toMatchObject({ type: "rpc.refused" });
      expect(await database.count(PAGE_METADATA_STORE)).toBe(0);
    });
  });

  it("pushes the map a co-attention edge once the user flips between two pages", async () => {
    const { app, clock } = await createSignalsApp();

    await app.handleNavigationCommitted(commit("https://example.org/a"));
    await app.handleNavigationCommitted({ ...commit("https://example.org/c"), tabId: 8 });

    const map = createFakePort();

    app.attachPort(map.port);
    map.send(buildRpcMessage("graph.subscribe", {}));

    for (const tabId of [7, 8, 7, 8]) {
      clock.now += 5_000;
      clock.focusedTabId = tabId;
      await app.handleTabActivated(tabId);
    }

    await vi.waitFor(() => {
      const latest = readSnapshots(map.posted).at(-1)?.payload as unknown as
        | { edges: { kind: string }[] }
        | undefined;

      expect(latest?.edges).toEqual([expect.objectContaining({ kind: "coAttention" })]);
    });
  });

  it("pushes the map a page's engagement as it changes", async () => {
    const { app, map } = await createSubscribedApp({
      tabCapture: createTabCapture(sessionTab()),
      readFocusedTab: () => Promise.resolve(7),
    });

    await app.handleNavigationCommitted(commit("https://example.org/a"));
    await app.handleTabActivated(7);
    await app.handleContentMessage(batch(0.2, 1), FROM_PAGE_A);

    await vi.waitFor(() =>
      expect(readSnapshots(map.posted).at(-1)?.payload.nodes).toEqual([
        expect.objectContaining({ engagement: "deep_read" }),
      ]),
    );
  });
});

/** A timer the test fires by hand, recording how often it was armed. */
const createTimer = () => {
  const pending = new Map<number, () => void>();
  const delays = new Map<number, number>();
  let next = 0;

  return {
    armed: () => next,
    /** Timers still to fire; with a delay, only those armed for it. */
    pending: (delayMs?: number) =>
      [...pending.keys()].filter((id) => delayMs === undefined || delays.get(id) === delayMs)
        .length,
    fire: () => {
      const due = [...pending.values()];

      pending.clear();
      due.forEach((callback) => {
        callback();
      });
    },
    setTimer: (callback: () => void, delayMs: number) => {
      next += 1;
      pending.set(next, callback);
      delays.set(next, delayMs);
      return next;
    },
    clearTimer: (handle: unknown) => {
      pending.delete(handle as number);
    },
  };
};

describe("clustering through the background", () => {
  it("clusters once after a burst of navigation, and pushes the clusters", async () => {
    const timer = createTimer();
    const { app, database, map } = await createSubscribedApp({
      tabCapture: createTabCapture(sessionTab(), sessionTab({ id: 8, openerTabId: 7 })),
      setTimer: timer.setTimer,
      clearTimer: timer.clearTimer,
    });

    await app.handleNavigationCommitted(commit("https://example.org/a"));
    await app.handleNavigationCommitted({ ...commit("https://example.org/c"), tabId: 8 });
    await app.handleNavigationCommitted(commit("https://example.org/b"));

    expect(timer.pending(RECLUSTER_DELAY_MS)).toBe(1);
    expect(await database.count(CLUSTERING_STORE)).toBe(0);

    timer.fire();

    await vi.waitFor(async () => expect(await database.count(CLUSTERING_STORE)).toBe(1));
    await vi.waitFor(() => {
      const latest = readSnapshots(map.posted).at(-1)?.payload as unknown as
        | { clusters: unknown[] }
        | undefined;

      expect(latest?.clusters).not.toHaveLength(0);
    });
  });

  it("clusters the session when the background starts", async () => {
    const { app, database } = await createSessionApp({
      tabCapture: createTabCapture(sessionTab()),
    });

    await database.put(SESSION_STORE, activeSession);
    await app.handleNavigationCommitted(commit("https://example.org/a"));
    await app.reconcileSession();

    expect(await database.get(CLUSTERING_STORE, "session-1")).toMatchObject({
      algorithmVersion: "louvain@1",
      clusters: [expect.objectContaining({ memberIds: [expect.any(String)] })],
    });
  });
});

/** An active, conformant embedding model, as activation leaves it. */
const EMBEDDING_MODEL = {
  ref: "Xenova/all-MiniLM-L6-v2@aaaa",
  manifest: {
    manifestVersion: 1,
    reference: {
      hub: "huggingface",
      repository: "Xenova/all-MiniLM-L6-v2",
      revision: "a".repeat(40),
    },
    format: "onnx",
    files: [
      { path: "onnx/model.onnx", bytes: 1, digest: { algorithm: "sha256", value: "0".repeat(64) } },
    ],
    license: "apache-2.0",
    contract: {
      family: "embedding",
      dimensions: 4,
      maxInputTokens: 256,
      pooling: "mean",
      normalize: true,
      similarity: "cosine",
      prefixes: { query: "", document: "" },
    },
  },
  active: true,
  conformance: "passed",
  diskBytes: 1,
  installedAt: 1,
} as const;

/** An embedding model stub that records how many calls run at once. */
const createEmbeddingStub = () => {
  let running = 0;
  const stub = {
    calls: 0,
    mostAtOnce: 0,
    load: vi.fn(() =>
      Promise.resolve({
        embed: async (texts: readonly string[]) => {
          stub.calls += 1;
          running += 1;
          stub.mostAtOnce = Math.max(stub.mostAtOnce, running);
          await new Promise((resolve) => setTimeout(resolve, 5));
          running -= 1;
          return texts.map(() => new Float32Array([1, 0, 0, 0]));
        },
      }),
    ),
  };

  return stub;
};

const extracted = (text: string) =>
  buildRpcMessage("content.extracted", {
    text,
    truncated: false,
    extractorVersion: "readability@0.6.0/1",
  });

describe("embedding deep-read pages through the background", () => {
  it("embeds a stored snapshot into the active model's space", async () => {
    const embedding = createEmbeddingStub();
    const { app, database, clock } = await createSignalsApp({
      loadEmbeddingSession: embedding.load,
    });

    await database.put(MODEL_STORE, EMBEDDING_MODEL as never);
    await app.handleNavigationCommitted(commit("https://example.org/a"));
    clock.focusedTabId = 7;
    await app.handleTabActivated(7);
    await app.handleContentMessage(batch(0.3, 1), FROM_PAGE_A);
    await app.handleContentMessage(extracted("Mid-drive motors sit at the cranks."), FROM_PAGE_A);

    await vi.waitFor(async () => expect(await database.count(VECTOR_STORE)).toBe(1));

    const [space] = await database.getAll(SPACE_STORE);

    // The session takes the space at the end of the job, after its vectors.
    await vi.waitFor(async () =>
      expect((await database.get(SESSION_STORE, "session-1"))?.activeEmbeddingSpaceId).toBe(
        space?.id,
      ),
    );
    expect(await database.getAll(JOB_STORE)).toEqual([expect.objectContaining({ status: "done" })]);
  });

  it("embeds what a page says about itself, when the page has no text yet", async () => {
    const embedding = createEmbeddingStub();
    const { app, database } = await createSignalsApp({ loadEmbeddingSession: embedding.load });

    await database.put(MODEL_STORE, EMBEDDING_MODEL as never);
    await app.handleNavigationCommitted(commit("https://example.org/a"));
    await app.handleContentMessage(pageMetadata("Mid-drive motors"), FROM_PAGE_A);

    await vi.waitFor(async () =>
      expect(await database.getAll(VECTOR_STORE)).toEqual([
        expect.objectContaining({ chunkId: expect.stringMatching(/^metadata:/u) }),
      ]),
    );
    expect(await database.getAll(JOB_STORE)).toEqual([
      expect.objectContaining({ type: "embedPageMetadata" }),
    ]);
  });

  it("keeps the metadata, and fails nothing, when no embedding model is active", async () => {
    const { app, database } = await createSignalsApp();

    await app.handleNavigationCommitted(commit("https://example.org/a"));
    await app.handleContentMessage(pageMetadata("Mid-drive motors"), FROM_PAGE_A);

    expect(await database.count(PAGE_METADATA_STORE)).toBe(1);
    expect(await database.count(JOB_STORE)).toBe(0);
  });

  it("holds the background loaded while an embedding job runs, and lets go after", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

    try {
      // The model answers only once the test opens this gate.
      const gate = { open: (): void => undefined };
      const touch = vi.fn(() => Promise.resolve());
      const load = vi.fn(() =>
        Promise.resolve({
          embed: async (texts: readonly string[]) => {
            await new Promise<void>((resolve) => {
              gate.open = resolve;
            });
            return texts.map(() => new Float32Array([1, 0, 0, 0]));
          },
        }),
      );
      const { app, database, clock } = await createSignalsApp({
        loadEmbeddingSession: load,
        backgroundLifetime: {
          touch,
          scheduleWake: () => Promise.resolve(),
          openHoldPage: () => Promise.reject(new Error("no tabs")),
          closeTab: () => Promise.resolve(),
        },
      });

      await database.put(MODEL_STORE, EMBEDDING_MODEL as never);
      await app.handleNavigationCommitted(commit("https://example.org/a"));
      clock.focusedTabId = 7;
      await app.handleTabActivated(7);
      await app.handleContentMessage(batch(0.3, 1), FROM_PAGE_A);
      await app.handleContentMessage(extracted("Mid-drive motors sit at the cranks."), FROM_PAGE_A);
      await vi.waitFor(() => expect(load).toHaveBeenCalled());

      // Waiting on the model: the hold touches the browser to count as active.
      vi.advanceTimersByTime(15_000);
      expect(touch).toHaveBeenCalledTimes(3);

      gate.open();
      await vi.waitFor(async () => expect(await database.count(VECTOR_STORE)).toBe(1));
      await vi.waitFor(async () =>
        expect((await database.getAll(JOB_STORE))[0]?.status).toBe("done"),
      );
      vi.advanceTimersByTime(60_000);

      expect(touch).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("switches the session to a new embedding model's space once it covers every chunk", async () => {
    const embedding = createEmbeddingStub();
    const { app, database, clock } = await createSignalsApp({
      loadEmbeddingSession: embedding.load,
    });

    await database.put(MODEL_STORE, EMBEDDING_MODEL as never);
    await app.handleNavigationCommitted(commit("https://example.org/a"));
    clock.focusedTabId = 7;
    await app.handleTabActivated(7);
    await app.handleContentMessage(batch(0.3, 1), FROM_PAGE_A);
    await app.handleContentMessage(extracted("Mid-drive motors sit at the cranks."), FROM_PAGE_A);
    await vi.waitFor(async () =>
      expect(
        (await database.get(SESSION_STORE, "session-1"))?.activeEmbeddingSpaceId,
      ).toBeDefined(),
    );

    const first = (await database.get(SESSION_STORE, "session-1"))?.activeEmbeddingSpaceId;
    const swapped = {
      ...EMBEDDING_MODEL,
      ref: "Xenova/other@bbbb",
      manifest: {
        ...EMBEDDING_MODEL.manifest,
        reference: { ...EMBEDDING_MODEL.manifest.reference, revision: "b".repeat(40) },
      },
    };
    await database.put(MODEL_STORE, { ...EMBEDDING_MODEL, active: false } as never);
    await database.put(MODEL_STORE, { ...swapped, installedAt: 9 } as never);
    await app.reconcileSession();

    await vi.waitFor(async () =>
      expect((await database.get(SESSION_STORE, "session-1"))?.activeEmbeddingSpaceId).not.toBe(
        first,
      ),
    );
    expect((await database.get(SPACE_STORE, first!))?.retiredAt).toBeDefined();
    expect(await app.handleMessage(buildRpcMessage("spaces.list", {}))).toMatchObject({
      type: "spaces.listed",
      payload: {
        spaces: expect.arrayContaining([
          expect.objectContaining({ id: first, inUse: false, retiredAt: expect.any(Number) }),
        ]),
      },
    });
    expect(
      await app.handleMessage(buildRpcMessage("spaces.remove", { spaceId: first! })),
    ).toMatchObject({ payload: { removed: true } });
  });

  it("queues nothing without an active embedding model", async () => {
    const embedding = createEmbeddingStub();
    const { app, database, clock } = await createSignalsApp({
      loadEmbeddingSession: embedding.load,
    });

    await app.handleNavigationCommitted(commit("https://example.org/a"));
    clock.focusedTabId = 7;
    await app.handleTabActivated(7);
    await app.handleContentMessage(batch(0.3, 1), FROM_PAGE_A);
    await app.handleContentMessage(extracted("Mid-drive motors."), FROM_PAGE_A);
    await app.reconcileSession();

    expect(await database.count(JOB_STORE)).toBe(0);
    expect(embedding.load).not.toHaveBeenCalled();
  });

  it("runs one job at a time, however many triggers arrive", async () => {
    const embedding = createEmbeddingStub();
    const { app, database, clock } = await createSignalsApp({
      loadEmbeddingSession: embedding.load,
      tabCapture: createTabCapture(
        sessionTab(),
        sessionTab({ id: 8, url: "https://example.org/c" }),
      ),
    });

    await app.handleNavigationCommitted(commit("https://example.org/a"));
    await app.handleNavigationCommitted({ ...commit("https://example.org/c"), tabId: 8 });

    for (const [tabId, url] of [
      [7, "https://example.org/a"],
      [8, "https://example.org/c"],
    ] as const) {
      clock.focusedTabId = tabId;
      await app.handleTabActivated(tabId);
      await app.handleContentMessage(batch(0.3, 1), { tabId, url });
      await app.handleContentMessage(extracted(`Text of ${url}.`), { tabId, url });
    }

    await database.put(MODEL_STORE, EMBEDDING_MODEL as never);
    await Promise.all([app.reconcileSession(), app.reconcileSession()]);

    await vi.waitFor(async () => expect(await database.count(VECTOR_STORE)).toBe(2));
    expect(embedding.mostAtOnce).toBe(1);
  });

  it("clusters again with the new vectors once an embedding job has finished", async () => {
    const embedding = createEmbeddingStub();
    const timer = createTimer();
    const { app, database, clock } = await createSignalsApp({
      loadEmbeddingSession: embedding.load,
      setTimer: timer.setTimer,
      clearTimer: timer.clearTimer,
    });

    await database.put(MODEL_STORE, EMBEDDING_MODEL as never);
    await app.handleNavigationCommitted(commit("https://example.org/a"));
    clock.focusedTabId = 7;
    await app.handleTabActivated(7);
    await app.handleContentMessage(batch(0.3, 1), FROM_PAGE_A);
    await app.handleContentMessage(extracted("Mid-drive motors sit at the cranks."), FROM_PAGE_A);
    await vi.waitFor(async () =>
      expect(await database.getAll(JOB_STORE)).toEqual([
        expect.objectContaining({ status: "done" }),
      ]),
    );
    await vi.waitFor(() => expect(timer.pending(RECLUSTER_DELAY_MS)).toBe(1));

    timer.fire();

    const [space] = await database.getAll(SPACE_STORE);

    await vi.waitFor(async () =>
      expect(await database.get(CLUSTERING_STORE, "session-1")).toMatchObject({
        embeddingSpaceId: space?.id,
      }),
    );
  });
});

/** A session with page A, deep read by a copy, its text kept. */
const createRecordedApp = async (overrides: Partial<BackgroundDependencies> = {}) => {
  const signals = await createSignalsApp(overrides);
  const { app, clock } = signals;

  await app.handleNavigationCommitted(commit("https://example.org/a"));
  clock.focusedTabId = 7;
  await app.handleTabActivated(7);
  await app.handleContentMessage(batch(0.8, 1), FROM_PAGE_A);
  await app.handleContentMessage(extracted("Mid-drive motors sit at the cranks."), FROM_PAGE_A);

  return signals;
};

describe("what was recorded, through the background", () => {
  it("lists the session's pages without their text, and reads a page's text on request", async () => {
    const { app, database } = await createRecordedApp();
    const answer = await app.handleMessage(buildRpcMessage("recorded.read", {}));
    const [node] = await database.getAll(NODE_STORE);

    expect(answer).toMatchObject({
      type: "recorded.session",
      payload: {
        session: {
          title: "E-bike motors",
          pages: [expect.objectContaining({ id: node?.id, snapshot: expect.any(Object) })],
        },
      },
    });
    expect(JSON.stringify(answer)).not.toContain("cranks");
    expect(
      await app.handleMessage(buildRpcMessage("recorded.readText", { nodeId: node?.id ?? "" })),
    ).toMatchObject({ payload: { text: "Mid-drive motors sit at the cranks." } });
  });

  it("answers the map with the start of a page's text, and nothing for an unknown page", async () => {
    const { app, database } = await createRecordedApp();
    const [node] = await database.getAll(NODE_STORE);

    expect(
      await app.handleMessage(buildRpcMessage("map.readExcerpt", { nodeId: node?.id ?? "" })),
    ).toMatchObject({
      type: "map.excerpt",
      payload: { nodeId: node?.id, text: "Mid-drive motors sit at the cranks." },
    });
    expect(
      await app.handleMessage(buildRpcMessage("map.readExcerpt", { nodeId: "missing" })),
    ).toMatchObject({ type: "map.excerpt", payload: { nodeId: "missing", text: null } });
  });

  it("deletes a page with its snapshot", async () => {
    const { app, database } = await createRecordedApp();
    const [node] = await database.getAll(NODE_STORE);

    expect(
      await app.handleMessage(buildRpcMessage("node.delete", { nodeId: node?.id ?? "" })),
    ).toMatchObject({ type: "node.deleted", payload: { deleted: true } });
    expect(await database.count(NODE_STORE)).toBe(0);
    expect(await database.count(SNAPSHOT_STORE)).toBe(0);
  });

  it("deletes the session, after which no session is active", async () => {
    const { app } = await createRecordedApp();

    expect(
      await app.handleMessage(buildRpcMessage("session.delete", { sessionId: "session-1" })),
    ).toMatchObject({ type: "session.deleted", payload: { deleted: true } });
    expect(await app.handleMessage(buildRpcMessage("recorded.read", {}))).toMatchObject({
      payload: { session: null },
    });
    expect(await app.handleMessage(buildRpcMessage("session.getActive", {}))).toMatchObject({
      payload: { sessions: [], viewedId: null },
    });
  });

  it("opens the page for the viewed session through its dependency", async () => {
    const openRecordedPage = vi.fn(() => Promise.resolve());
    const { app, database } = await createSessionApp({ openRecordedPage });
    await database.put(SESSION_STORE, activeSession);

    expect(await app.handleMessage(buildRpcMessage("recorded.open", {}))).toMatchObject({
      type: "recorded.opened",
    });
    expect(openRecordedPage).toHaveBeenCalledWith("session-1");
  });
});

describe("saving and resuming through the background", () => {
  it("keeps the session saved as the user goes, and lists it once its group is gone", async () => {
    const tabs = [sessionTab(), sessionTab({ id: 8, url: "https://example.org/c" })];
    const queryGroupTabs = vi.fn(async () => tabs.map((tab) => ({ ...tab, windowId: 1 })));
    const timer = createTimer();
    const signals = await createSignalsApp({
      tabCapture: { ...createTabCapture(...tabs), queryGroupTabs },
      setTimer: timer.setTimer,
      clearTimer: timer.clearTimer,
    });
    const { app, database, clock } = signals;

    await app.handleNavigationCommitted(commit("https://example.org/a"));
    await app.handleNavigationCommitted({ ...commit("https://example.org/c"), tabId: 8 });
    clock.focusedTabId = 7;
    await app.handleTabActivated(7);
    await app.handleContentMessage(batch(0.9), FROM_PAGE_A);

    expect((await database.get(SESSION_STORE, "session-1"))?.savedTabs).toBeUndefined();

    // Once capture has been quiet for a moment, the tabs are recorded.
    timer.fire();
    await vi.waitFor(async () => {
      expect((await database.get(SESSION_STORE, "session-1"))?.savedTabs).toHaveLength(2);
    });

    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({
      status: "active",
      savedTabs: [
        expect.objectContaining({ url: "https://example.org/a" }),
        expect.objectContaining({ url: "https://example.org/c" }),
      ],
    });

    // Closing the group removes its tabs one by one, then the group, before
    // capture is quiet again: what was on record stays.
    queryGroupTabs.mockResolvedValue([{ ...tabs[0]!, windowId: 1 }]);
    await app.handleTabRemoved(8, { isWindowClosing: false });
    queryGroupTabs.mockResolvedValue([]);
    await app.handleTabRemoved(7, { isWindowClosing: false });
    await app.handleGroupRemoved({ id: 42 });
    timer.fire();

    const nodeA = await readNodeByUrl(database, "https://example.org/a");

    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({
      status: "closed",
      savedTabs: [
        expect.objectContaining({ url: "https://example.org/a" }),
        expect.objectContaining({ url: "https://example.org/c" }),
      ],
      lastPosition: expect.objectContaining({ nodeId: nodeA?.id, readFraction: 0.9 }),
    });
    expect(await app.handleMessage(buildRpcMessage("library.list", {}))).toMatchObject({
      payload: { sessions: [expect.objectContaining({ id: "session-1", pageCount: 2 })] },
    });
  });

  it("resumes a saved session onto new tabs, reopening its pages without recording new ones", async () => {
    let next = 100;
    const resumeApi = {
      createTab: vi.fn(() => Promise.resolve({ id: next++ })),
      groupTabs: vi.fn(() => Promise.resolve(77)),
      updateGroup: vi.fn(() => Promise.resolve()),
      getGroup: vi.fn(() => Promise.reject(new Error("No group"))),
      activateTab: vi.fn(() => Promise.resolve()),
      removeTab: vi.fn(() => Promise.resolve()),
    };
    const { app, database } = await createSignalsApp({
      resumeApi,
      tabCapture: createTabCapture(
        sessionTab(),
        sessionTab({ id: 8, url: "https://example.org/c" }),
        sessionTab({ id: 100, groupId: 77 }),
        sessionTab({ id: 101, groupId: 77, url: "https://example.org/c" }),
      ),
    });

    await app.handleNavigationCommitted(commit("https://example.org/a"));
    await app.handleNavigationCommitted({ ...commit("https://example.org/c"), tabId: 8 });
    await database.put(SESSION_STORE, {
      ...(await database.get(SESSION_STORE, "session-1"))!,
      status: "saved",
      // In tab-strip order: A, then C.
      savedTabs: (await database.getAll(NODE_STORE))
        .toSorted((first, second) => first.url.localeCompare(second.url))
        .map(({ id, url, title }) => ({
          nodeId: id,
          url,
          title,
        })),
    });

    expect(
      await app.handleMessage(buildRpcMessage("session.resume", { sessionId: "session-1" })),
    ).toMatchObject({ type: "session.resumed" });

    // The left-off page loads its URL in its new tab: still the same page.
    await app.handleNavigationCommitted({ ...commit("https://example.org/a"), tabId: 100 });

    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({
      status: "active",
      groupId: 77,
    });
    expect(
      (await database.getAll(NODE_STORE))
        .map(({ tabId, tabState }) => [tabId, tabState])
        .toSorted(),
    ).toEqual([
      [100, "open"],
      [101, "open"],
    ]);
  });

  it("resumes beside an active session, leaving it recording", async () => {
    const removeTab = vi.fn(() => Promise.resolve());
    const { app, database } = await createSignalsApp({
      resumeApi: {
        createTab: vi.fn(() => Promise.resolve({ id: 1 })),
        groupTabs: vi.fn(() => Promise.resolve(77)),
        updateGroup: vi.fn(() => Promise.resolve()),
        getGroup: vi.fn(() => Promise.reject(new Error("No group"))),
        activateTab: vi.fn(() => Promise.resolve()),
        removeTab,
      },
    });

    await database.put(SESSION_STORE, {
      ...activeSession,
      id: "session-0",
      groupId: 5,
      status: "saved",
    });

    expect(
      await app.handleMessage(buildRpcMessage("session.resume", { sessionId: "session-0" })),
    ).toMatchObject({ type: "session.resumed", payload: { sessionId: "session-0" } });
    expect((await database.get(SESSION_STORE, "session-0"))?.status).toBe("active");
    expect((await database.get(SESSION_STORE, activeSession.id))?.status).toBe("active");
    expect(removeTab).not.toHaveBeenCalled();
    expect(await app.handleMessage(buildRpcMessage("session.getActive", {}))).toMatchObject({
      payload: { viewedId: "session-0" },
    });
  });

  it("refuses to resume a session that is already active", async () => {
    const { app } = await createSignalsApp();

    expect(
      await app.handleMessage(buildRpcMessage("session.resume", { sessionId: activeSession.id })),
    ).toMatchObject({
      type: "session.resumeFailed",
      payload: { reason: "Only a saved session can be resumed." },
    });
  });
});

/** A saved session whose first search was "e-bike motors", and an active one. */
const createReattachApp = async () => {
  const signals = await createSignalsApp();
  const { database } = signals;

  await database.put(SESSION_STORE, {
    ...activeSession,
    id: "old",
    title: "E-bike motors",
    groupId: 4,
    status: "saved",
  });
  await database.put(NODE_STORE, {
    id: "old-root",
    sessionId: "old",
    tabId: 3,
    kind: "serp",
    query: "e-bike motors",
    url: "https://duckduckgo.com/?q=e-bike+motors",
    domain: "duckduckgo.com",
    title: "e-bike motors",
    parentNodeId: null,
    openerNodeId: null,
    transitionType: "typed",
    signals: {
      activeDwellMs: 0,
      maxScroll: 0,
      copyEvents: 0,
      pasteEvents: 0,
      focusCount: 1,
      revisitCount: 0,
      quickReturnCount: 0,
    },
    tabState: "closed",
    createdAt: 1,
  });

  return signals;
};

const search = (query: string) =>
  commit(`https://duckduckgo.com/?q=${encodeURIComponent(query).replaceAll("%20", "+")}`);

describe("continuing a saved session through the background", () => {
  it("offers to continue the saved session once a matching first search is recorded", async () => {
    const { app, database } = await createReattachApp();

    await app.handleNavigationCommitted(search("e-bike mid-drive motors"));

    await vi.waitFor(async () =>
      expect((await database.get(SESSION_STORE, "session-1"))?.reattachSuggestion).toEqual({
        sessionId: "old",
        title: "E-bike motors",
      }),
    );
    expect(await app.handleMessage(buildRpcMessage("session.getActive", {}))).toMatchObject({
      payload: { sessions: [{ reattachSuggestion: { sessionId: "old" } }] },
    });
  });

  it("offers nothing for an unrelated first search", async () => {
    const { app, database } = await createReattachApp();

    await app.handleNavigationCommitted(search("sourdough starter"));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect((await database.get(SESSION_STORE, "session-1"))?.reattachSuggestion).toBeUndefined();
  });

  it("continues the saved session with the new search as a refinement of its first", async () => {
    const updateGroup = vi.fn(() => Promise.resolve());
    const { app, database } = await createReattachApp();

    await app.handleNavigationCommitted(search("e-bike mid-drive motors"));

    const reattaching = createBackgroundApp(
      buildDependencies({
        openDatabase: () => Promise.resolve(database),
        tabGroups: createStubTabGroups({ updateGroup }),
      }),
    );

    expect(
      await reattaching.handleMessage(
        buildRpcMessage("session.reattach", { savedSessionId: "old" }),
      ),
    ).toMatchObject({ type: "session.reattached", payload: { title: "E-bike motors" } });
    expect(await database.get(SESSION_STORE, "session-1")).toBeUndefined();
    expect(await database.get(SESSION_STORE, "old")).toMatchObject({
      status: "active",
      groupId: 42,
    });
    expect((await database.getAll(NODE_STORE)).every(({ sessionId }) => sessionId === "old")).toBe(
      true,
    );
    expect((await database.getAll(EDGE_STORE)).map(({ kind }) => kind)).toContain("refinement");
    expect(updateGroup).toHaveBeenCalledWith(42, { title: "E-bike motors" });
  });

  it("keeps the sessions apart, and stops offering", async () => {
    const { app, database } = await createReattachApp();

    await app.handleNavigationCommitted(search("e-bike mid-drive motors"));
    await vi.waitFor(async () =>
      expect((await database.get(SESSION_STORE, "session-1"))?.reattachSuggestion).toBeDefined(),
    );

    expect(await app.handleMessage(buildRpcMessage("session.keepSeparate", {}))).toMatchObject({
      type: "session.keptSeparate",
    });
    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({
      reattachDeclined: true,
    });
    expect((await database.get(SESSION_STORE, "old"))?.status).toBe("saved");
  });
});

/** An answer from the fake Ollama below. */
const answerJson = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body)));

/**
 * A deterministic stand-in for a real embedding: each probe pair's anchor and
 * paraphrase share an axis, as a working model would put them close, and any
 * other text gets an axis of its own from its content.
 */
const embedLikeAModel = (rawText: string, dimensions: number): number[] => {
  const text = rawText.replace(/^search_(query|document): /u, "");
  const pairIndex = PARAPHRASE_PROBES.findIndex(
    ({ anchor, paraphrase }) => text === anchor || text === paraphrase,
  );
  let axis = pairIndex;

  if (axis === -1) {
    axis = PARAPHRASE_PROBES.length;

    for (const character of text) {
      axis = (axis * 31 + character.charCodeAt(0)) % dimensions;
    }

    axis = PARAPHRASE_PROBES.length + (axis % (dimensions - PARAPHRASE_PROBES.length));
  }

  return Array.from({ length: dimensions }, (_, position) => (position === axis ? 1 : 0));
};

/** A fake Ollama, with nomic-embed-text pulled unless told otherwise, recording what it was asked. */
/** One NDJSON line of a chat answer. */
const chatLine = (content: string, doneReason?: string) =>
  `${JSON.stringify({
    message: { role: "assistant", content },
    done: doneReason !== undefined,
    ...(doneReason === undefined ? {} : { done_reason: doneReason }),
  })}\n`;

/**
 * What a chat model answers: an extraction probe's product when asked in a
 * schema, else a long count that stops at `num_predict` or, given room, runs
 * until the request is aborted — as a real connection does.
 */
const answerChat = (init: RequestInit | undefined, isChatBroken: boolean) => {
  const body = JSON.parse(String(init?.body)) as {
    messages: { content: string }[];
    format?: unknown;
    options: { num_predict: number };
  };
  const encoder = new TextEncoder();
  const signal = init?.signal ?? undefined;

  if (body.format !== undefined) {
    const passage = body.messages.at(-1)?.content;

    // An open-questions request: the facts as data, under the questions prompt.
    if (
      passage?.startsWith("<facts>\n") === true &&
      body.messages[0]?.content.includes("decide what to look up next") === true &&
      !isChatBroken
    ) {
      return Promise.resolve(
        new Response(
          chatLine(
            JSON.stringify({
              questions: [{ question: "Is the motor serviceable?", query: "motor service" }],
            }),
          ) + chatLine("", "stop"),
        ),
      );
    }

    // A summary request: one statement citing the first fact, one inventing one.
    if (passage?.startsWith("<facts>\n") === true && !isChatBroken) {
      return Promise.resolve(
        new Response(
          chatLine(
            JSON.stringify({
              statements: [
                { text: "Mid-drive motors sit at the cranks.", facts: ["F1"] },
                { text: "Invented.", facts: ["F99"] },
              ],
            }),
          ) + chatLine("", "stop"),
        ),
      );
    }

    // A fact-extraction request: one fact quoting the passage's first words,
    // and one the passage does not say.
    // The request may open with the page's context block; the passage is what follows.
    const passageStart = passage?.indexOf("<page_text>\n") ?? -1;

    if (passage !== undefined && passageStart !== -1 && !isChatBroken) {
      const text = passage.slice(passageStart + "<page_text>\n".length, -"\n</page_text>".length);

      return Promise.resolve(
        new Response(
          chatLine(
            JSON.stringify({
              entities: [{ name: "Motor", entity_type: "product" }],
              facts: [
                {
                  subject: "Motor",
                  attribute: "placement",
                  concept: "placement",
                  value: "x",
                  quote: text.slice(0, 20),
                },
                {
                  subject: "Motor",
                  attribute: "colour",
                  concept: "colour",
                  value: "red",
                  quote: "comes in red",
                },
              ],
            }),
          ) + chatLine("", "stop"),
        ),
      );
    }

    const probe = EXTRACTION_PROBES.find((candidate) => candidate.passage === passage);
    // Any other passage is the timed article, answered with facts.
    const answer = isChatBroken
      ? "I think it costs a lot."
      : JSON.stringify(
          probe?.expected ?? {
            products: [
              {
                name: "Volta E5",
                priceUsd: 2399,
                weightKg: 23.5,
                batteryWh: 500,
                torqueNm: 85,
                rangeKm: 96,
              },
            ],
          },
        );

    return Promise.resolve(new Response(chatLine(answer) + chatLine("", "stop")));
  }

  const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.enqueue(encoder.encode(chatLine("one, two, ")));

      if (body.options.num_predict <= 16) {
        controller.enqueue(encoder.encode(chatLine("", "length")));
        controller.close();
      } else {
        signal?.addEventListener("abort", () => {
          controller.error(new DOMException("Aborted", "AbortError"));
        });
      }
    },
  });

  return Promise.resolve(new Response(stream));
};

const createFakeOllama = ({
  isRunning = true,
  hasModel = true,
  isBroken = false,
  chatModels = [] as string[],
  isChatBroken = false,
  chatDelayMs = 0,
}: {
  isRunning?: boolean;
  hasModel?: boolean;
  isBroken?: boolean;
  /** Chat models Ollama has pulled, such as `qwen3:0.6b`. */
  chatModels?: string[];
  isChatBroken?: boolean;
  /** How long a chat takes before it answers, as a long answer does. */
  chatDelayMs?: number;
} = {}) => {
  const state = {
    isRunning,
    hasModel,
    chatModels: [...chatModels],
    embedCalls: 0,
    chatCalls: 0,
    pulls: 0,
  };
  const DIGEST = "d".repeat(64);
  const CHAT_DIGEST = "e".repeat(64);
  const DIMENSIONS = 256;
  const fetchResource = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (!state.isRunning) {
      return Promise.reject(new TypeError("NetworkError when attempting to fetch resource."));
    }

    if (url.endsWith("/api/tags")) {
      return answerJson({
        models: [
          ...(state.hasModel
            ? [{ name: "nomic-embed-text:latest", digest: DIGEST, size: 274_000_000 }]
            : []),
          ...state.chatModels.map((name) => ({ name, digest: CHAT_DIGEST, size: 2_500_000_000 })),
        ],
      });
    }

    if (url.endsWith("/api/show")) {
      const { model } = JSON.parse(String(init?.body)) as { model: string };

      if (state.chatModels.includes(model)) {
        return answerJson({
          license: "Apache",
          capabilities: ["completion", "thinking"],
          model_info: {
            "general.architecture": "qwen3",
            "qwen3.embedding_length": 2560,
            "qwen3.context_length": 40960,
          },
        });
      }

      return answerJson({
        license: "Apache",
        capabilities: ["embedding"],
        model_info: {
          "general.architecture": "nomic-bert",
          "nomic-bert.embedding_length": DIMENSIONS,
          "nomic-bert.context_length": 2048,
        },
      });
    }

    if (url.endsWith("/api/pull")) {
      const { model } = JSON.parse(String(init?.body)) as { model: string };

      state.pulls += 1;

      if (model.includes("qwen")) {
        state.chatModels.push(model);
      } else {
        state.hasModel = true;
      }

      return Promise.resolve(
        new Response(
          [
            { status: "pulling manifest" },
            { status: "downloading", total: 100, completed: 50 },
            { status: "success" },
          ]
            .map((line) => JSON.stringify(line))
            .join("\n"),
        ),
      );
    }

    if (url.endsWith("/api/embed")) {
      state.embedCalls += 1;

      const { input: texts } = JSON.parse(String(init?.body)) as { input: string[] };

      return answerJson({
        embeddings: texts.map((text, index) =>
          isBroken
            ? Array.from({ length: DIMENSIONS }, (_, position) => (position === 0 ? 1 : index))
            : embedLikeAModel(text, DIMENSIONS),
        ),
      });
    }

    if (url.endsWith("/api/chat")) {
      state.chatCalls += 1;

      return new Promise<void>((resolve) => {
        setTimeout(resolve, chatDelayMs);
      }).then(() => answerChat(init, isChatBroken));
    }

    return Promise.reject(new Error(`Unexpected ${url}`));
  }) as unknown as typeof fetch;

  return { state, fetchResource, digest: DIGEST, chatDigest: CHAT_DIGEST };
};

describe("Ollama through the background", () => {
  it("contacts nothing and says it is not connected until the user starts setup", async () => {
    const ollama = createFakeOllama();
    const fetchResource = vi.fn(ollama.fetchResource) as unknown as typeof fetch;
    const { app } = await createSessionApp({ fetchResource });

    expect(await app.handleMessage(buildRpcMessage("ollama.status", {}))).toMatchObject({
      type: "ollama.state",
      payload: { state: "notConnected", models: [] },
    });
    expect(fetchResource).not.toHaveBeenCalled();

    await app.handleMessage(buildRpcMessage("aiSetup.start", {}));

    expect(await app.handleMessage(buildRpcMessage("ollama.status", {}))).toMatchObject({
      payload: { state: "running" },
    });
  });

  it("says it is not running, then lists its models once it is", async () => {
    const ollama = createFakeOllama({ isRunning: false });
    const { app } = await createSessionApp({
      fetchResource: ollama.fetchResource,
    });

    await app.handleMessage(buildRpcMessage("aiSetup.start", {}));

    expect(await app.handleMessage(buildRpcMessage("ollama.status", {}))).toMatchObject({
      payload: { state: "unreachable" },
    });

    ollama.state.isRunning = true;

    expect(await app.handleMessage(buildRpcMessage("ollama.status", {}))).toMatchObject({
      payload: {
        state: "running",
        models: [
          expect.objectContaining({ name: "nomic-embed-text:latest", registeredRef: null }),
          expect.objectContaining({ name: "qwen3:4b", isPulled: false }),
        ],
      },
    });
  });

  it("registers a model inactive, then runs its conformance through the server", async () => {
    const ollama = createFakeOllama();
    const { app, database } = await createSessionApp({
      fetchResource: ollama.fetchResource,
    });
    const registered = await app.handleMessage(
      buildRpcMessage("ollama.register", { name: "nomic-embed-text:latest" }),
    );
    const ref = `ollama:nomic-embed-text:latest@${ollama.digest}`;

    expect(registered).toMatchObject({ type: "ollama.registered", payload: { ref } });
    expect(await database.get(MODEL_STORE, ref)).toMatchObject({
      active: false,
      conformance: "pending",
      manifest: { format: "local-server", contract: { dimensions: 256 } },
    });

    await app.handleMessage(buildRpcMessage("model.activate", { ref }));

    expect(ollama.state.embedCalls).toBeGreaterThan(0);
    expect((await database.get(MODEL_STORE, ref))?.conformance).not.toBe("pending");
  });

  it("embeds deep-read pages through Ollama, pauses while it is away, and resumes when it is back", async () => {
    const ollama = createFakeOllama();
    const { app, database, clock } = await createSignalsApp({
      fetchResource: ollama.fetchResource,
    });

    // A model is registered through setup, so the user has started it.
    await app.handleMessage(buildRpcMessage("aiSetup.start", {}));

    await app.handleMessage(
      buildRpcMessage("ollama.register", { name: "nomic-embed-text:latest" }),
    );

    const ref = `ollama:nomic-embed-text:latest@${ollama.digest}`;

    await database.put(MODEL_STORE, {
      ...(await database.get(MODEL_STORE, ref))!,
      active: true,
      conformance: "passed",
    });
    await app.handleNavigationCommitted(commit("https://example.org/a"));
    clock.focusedTabId = 7;
    await app.handleTabActivated(7);
    await app.handleContentMessage(batch(0.3, 1), FROM_PAGE_A);
    await app.handleContentMessage(extracted("Mid-drive motors sit at the cranks."), FROM_PAGE_A);

    await vi.waitFor(async () => expect(await database.count(VECTOR_STORE)).toBe(1));
    expect(await app.handleMessage(buildRpcMessage("ollama.health", {}))).toMatchObject({
      payload: { isPaused: false },
    });

    ollama.state.isRunning = false;
    await app.handleNavigationCommitted(commit("https://example.org/b"));
    await app.handleContentMessage(batch(0.3, 1), { tabId: 7, url: "https://example.org/b" });
    await app.handleContentMessage(extracted("Hub motors sit in the wheel."), {
      tabId: 7,
      url: "https://example.org/b",
    });

    await vi.waitFor(async () =>
      expect(await app.handleMessage(buildRpcMessage("ollama.health", {}))).toMatchObject({
        payload: { isPaused: true },
      }),
    );

    // Ollama comes back; the next look at it resumes what waited.
    ollama.state.isRunning = true;
    await app.handleMessage(buildRpcMessage("ollama.status", {}));

    await vi.waitFor(async () => expect(await database.count(VECTOR_STORE)).toBe(2));
    expect(await app.handleMessage(buildRpcMessage("ollama.health", {}))).toMatchObject({
      payload: { isPaused: false },
    });
  });
});

describe("AI setup through the background", () => {
  it("answers a fresh install's status from storage, contacting nothing", async () => {
    const fetchResource = vi.fn() as unknown as typeof fetch;
    const { app } = await createSessionApp({ fetchResource });

    expect(await app.handleMessage(buildRpcMessage("aiSetup.read", {}))).toMatchObject({
      type: "aiSetup.status",
      payload: { isSetUp: false, isStarted: false, isBannerCollapsed: false },
    });
    expect(fetchResource).not.toHaveBeenCalled();
  });

  it("records that setup started, and how the banner was left", async () => {
    const { app } = await createSessionApp();

    await app.handleMessage(buildRpcMessage("aiSetup.start", {}));

    expect(
      await app.handleMessage(buildRpcMessage("aiSetup.collapseBanner", { isCollapsed: true })),
    ).toMatchObject({
      type: "aiSetup.status",
      payload: { isStarted: true, isBannerCollapsed: true },
    });
  });
});

describe("telling the user that AI needs setting up", () => {
  it("shows the notification once on a first install, never on an update", async () => {
    const showSetupNotification = vi.fn(() => Promise.resolve());
    const { app } = await createSessionApp({ showSetupNotification });

    await app.handleInstalled("update");
    expect(showSetupNotification).not.toHaveBeenCalled();

    await app.handleInstalled("install");
    expect(showSetupNotification).toHaveBeenCalledOnce();
  });

  it("opens the setup page when the notification is clicked, or a surface asks", async () => {
    const openSetupPage = vi.fn(() => Promise.resolve());
    const { app } = await createSessionApp({ openSetupPage });

    await app.handleSetupNotificationClicked();
    expect(await app.handleMessage(buildRpcMessage("aiSetup.open", {}))).toMatchObject({
      type: "aiSetup.opened",
    });
    expect(openSetupPage).toHaveBeenCalledTimes(2);
  });

  it("badges the icon until an embedding model is on, then clears it", async () => {
    const setBadge = vi.fn((_state: unknown) => Promise.resolve());
    const ollama = createFakeOllama();
    const { app } = await createSessionApp({ fetchResource: ollama.fetchResource, setBadge });

    await app.handleStartup();
    await vi.waitFor(() => expect(setBadge).toHaveBeenLastCalledWith("needsSetup"));

    await app.handleMessage(buildRpcMessage("aiSetup.turnOn", {}));
    await vi.waitFor(() => expect(setBadge).toHaveBeenLastCalledWith(undefined));
  });
});

/** The types a fake port was sent, in order. */
const typesOf = (posted: unknown[]) => posted.map((message) => (message as { type: string }).type);

/** The "Turn on AI" progress a fake port was sent, in order. */
const progressOf = (posted: unknown[]) =>
  posted
    .filter((message) => (message as { type: string }).type === "aiSetup.turnOnProgress")
    .map((message) => (message as { payload: TurnOnProgress }).payload);

describe("Turning AI on from the setup page", () => {
  it("downloads, checks and activates both models, embedding first, under one progress", async () => {
    const ollama = createFakeOllama({ hasModel: false });
    const { app, database } = await createSessionApp({ fetchResource: ollama.fetchResource });
    const { port, posted, send } = createFakePort();

    app.attachPort(port);
    send(buildRpcMessage("aiSetup.turnOn", {}));

    await vi.waitFor(() => expect(typesOf(posted)).toContain("aiSetup.turnedOn"), {
      timeout: 5_000,
    });

    const progress = progressOf(posted);

    expect(ollama.state.pulls).toBe(2);
    expect(progress[0]).toMatchObject({ family: "embedding", stage: "downloading" });
    expect(progress.at(-1)).toMatchObject({ family: "text-generation", isEmbeddingReady: true });
    expect(progress.map(({ fraction }) => fraction)).toEqual(
      progress.map(({ fraction }) => fraction).toSorted((left, right) => left - right),
    );
    expect(posted.at(-1)).toMatchObject({ type: "aiSetup.turnedOn", payload: { isSetUp: true } });

    const models = await database.getAll(MODEL_STORE);

    expect(
      models.filter(({ active }) => active).map(({ manifest }) => manifest.contract.family),
    ).toEqual(expect.arrayContaining(["embedding", "text-generation"]));
    expect((await app.handleMessage(buildRpcMessage("aiSetup.read", {}))).payload).toMatchObject({
      isStarted: true,
    });
  });

  it("does not download a model Ollama already has", async () => {
    const ollama = createFakeOllama({ hasModel: false, chatModels: ["qwen3:4b"] });
    const { app } = await createSessionApp({ fetchResource: ollama.fetchResource });

    expect(await app.handleMessage(buildRpcMessage("aiSetup.turnOn", {}))).toMatchObject({
      type: "aiSetup.turnedOn",
      payload: { isSetUp: true },
    });
    expect(ollama.state.pulls).toBe(1);
  });

  it("says Ollama isn't running, before anything else", async () => {
    const ollama = createFakeOllama({ isRunning: false });
    const { app } = await createSessionApp({ fetchResource: ollama.fetchResource });

    expect(await app.handleMessage(buildRpcMessage("aiSetup.turnOn", {}))).toMatchObject({
      type: "aiSetup.turnOnFailed",
      payload: { reason: "Ollama isn't running." },
    });
  });

  it("names the model and stage that failed", async () => {
    const ollama = createFakeOllama({ isBroken: true });
    const { app } = await createSessionApp({ fetchResource: ollama.fetchResource });

    expect(await app.handleMessage(buildRpcMessage("aiSetup.turnOn", {}))).toMatchObject({
      type: "aiSetup.turnOnFailed",
      payload: { name: "nomic-embed-text:latest", stage: "checking" },
    });
  });

  it("keeps the embedding model on when the generation model fails", async () => {
    const ollama = createFakeOllama({ chatModels: ["qwen3:4b"], isChatBroken: true });
    const { app } = await createSessionApp({ fetchResource: ollama.fetchResource });

    expect(await app.handleMessage(buildRpcMessage("aiSetup.turnOn", {}))).toMatchObject({
      type: "aiSetup.turnOnFailed",
      payload: { name: "qwen3:4b", stage: "checking" },
    });
    expect((await app.handleMessage(buildRpcMessage("aiSetup.read", {}))).payload).toMatchObject({
      isSetUp: true,
    });
  });

  it("lets a reopened page follow a run already under way", async () => {
    const ollama = createFakeOllama({ chatModels: ["qwen3:4b"], chatDelayMs: 20 });
    const { app } = await createSessionApp({ fetchResource: ollama.fetchResource });
    const first = createFakePort();
    const second = createFakePort();

    app.attachPort(first.port);
    first.send(buildRpcMessage("aiSetup.turnOn", {}));
    await vi.waitFor(() => expect(progressOf(first.posted).length).toBeGreaterThan(0));

    app.attachPort(second.port);
    second.send(buildRpcMessage("aiSetup.watch", {}));

    await vi.waitFor(() =>
      expect(second.posted[0]).toMatchObject({
        type: "aiSetup.turnOnState",
        payload: {
          isRunning: true,
          progress: expect.objectContaining({ fraction: expect.any(Number) }),
        },
      }),
    );
    await vi.waitFor(() => expect(typesOf(first.posted)).toContain("aiSetup.turnedOn"), {
      timeout: 5_000,
    });
    // The page that only followed is told how the run ended.
    await vi.waitFor(() =>
      expect(second.posted.at(-1)).toMatchObject({
        type: "aiSetup.turnedOn",
        payload: { isSetUp: true },
      }),
    );
    expect(await app.handleMessage(buildRpcMessage("aiSetup.watch", {}))).toMatchObject({
      payload: { isRunning: false },
    });
  });
});

describe("Turning local AI on in one action", () => {
  it("downloads the missing model with progress, then registers, checks and activates it", async () => {
    const ollama = createFakeOllama({ hasModel: false });
    const { app, database } = await createSessionApp({
      fetchResource: ollama.fetchResource,
    });
    const { port, posted, send } = createFakePort();

    app.attachPort(port);
    send(buildRpcMessage("ollama.enable", { name: "nomic-embed-text" }));
    await vi.waitFor(
      () =>
        expect(posted.map((message) => (message as { type: string }).type)).toContain(
          "ollama.enabled",
        ),
      { timeout: 10_000 },
    );

    const ref = `ollama:nomic-embed-text:latest@${ollama.digest}`;

    expect(posted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "ollama.enableProgress",
          payload: { name: "nomic-embed-text", stage: "downloading", percent: 50 },
        }),
        expect.objectContaining({
          type: "ollama.enableProgress",
          payload: { name: "nomic-embed-text", stage: "checking" },
        }),
        expect.objectContaining({
          type: "ollama.enabled",
          payload: { name: "nomic-embed-text", ref },
        }),
      ]),
    );
    expect(ollama.state.pulls).toBe(1);
    expect(await database.get(MODEL_STORE, ref)).toMatchObject({
      active: true,
      conformance: "passed",
    });
  });

  it("does not download a model Ollama already has", async () => {
    const ollama = createFakeOllama();
    const { app } = await createSessionApp({
      fetchResource: ollama.fetchResource,
    });

    expect(
      await app.handleMessage(buildRpcMessage("ollama.enable", { name: "nomic-embed-text" })),
    ).toMatchObject({ type: "ollama.enabled" });
    expect(ollama.state.pulls).toBe(0);
  });

  it("says Ollama isn't running, before anything else", async () => {
    const { app } = await createSessionApp({
      fetchResource: createFakeOllama({ isRunning: false }).fetchResource,
    });

    expect(
      await app.handleMessage(buildRpcMessage("ollama.enable", { name: "nomic-embed-text" })),
    ).toMatchObject({
      type: "ollama.enableFailed",
      payload: { stage: "downloading", reason: "Ollama isn't running." },
    });
  });

  it("says the quality check failed, and leaves the model inactive", async () => {
    const ollama = createFakeOllama({ isBroken: true });
    const { app, database } = await createSessionApp({
      fetchResource: ollama.fetchResource,
    });

    expect(
      await app.handleMessage(buildRpcMessage("ollama.enable", { name: "nomic-embed-text" })),
    ).toMatchObject({ type: "ollama.enableFailed", payload: { stage: "checking" } });
    expect(
      (await database.get(MODEL_STORE, `ollama:nomic-embed-text:latest@${ollama.digest}`))?.active,
    ).toBe(false);
  });
});

describe("Page summaries through Ollama", () => {
  it("registers a chat model as a generation model and checks it by generating", async () => {
    const ollama = createFakeOllama({ chatModels: ["qwen3:4b"] });
    const { app, database } = await createSessionApp({
      fetchResource: ollama.fetchResource,
    });
    const ref = `ollama:qwen3:4b@${ollama.chatDigest}`;

    expect(
      await app.handleMessage(buildRpcMessage("ollama.register", { name: "qwen3:4b" })),
    ).toMatchObject({ type: "ollama.registered", payload: { ref } });
    expect(await database.get(MODEL_STORE, ref)).toMatchObject({
      active: false,
      manifest: { contract: { family: "text-generation", contextWindow: 40960 } },
    });

    const activated = await app.handleMessage(buildRpcMessage("model.activate", { ref }));

    expect(activated).toMatchObject({
      type: "model.activated",
      payload: {
        active: true,
        probes: [
          expect.objectContaining({ name: "stops when cancelled", passed: true }),
          expect.objectContaining({ name: "stops at its token limit", passed: true }),
          expect.objectContaining({
            name: "extracts products into a schema",
            detail: "5 of 5 extracted correctly, 4 required",
          }),
        ],
      },
    });
    expect(ollama.state.embedCalls).toBe(0);
  });

  it("keeps the embedding model active beside the generation model", async () => {
    const ollama = createFakeOllama({ chatModels: ["qwen3:4b"] });
    const { app, database } = await createSessionApp({
      fetchResource: ollama.fetchResource,
    });

    await app.handleMessage(buildRpcMessage("ollama.enable", { name: "nomic-embed-text" }));
    await app.handleMessage(buildRpcMessage("ollama.enable", { name: "qwen3:4b" }));

    const active = (await database.getAll(MODEL_STORE))
      .filter(({ active: isActive }) => isActive)
      .map(({ manifest }) => manifest.contract.family);

    expect(active.toSorted()).toEqual(["embedding", "text-generation"]);
  });

  it("downloads the tagged model even when Ollama has another tag of it", async () => {
    const ollama = createFakeOllama({ chatModels: ["qwen3:0.6b"] });
    const { app } = await createSessionApp({
      fetchResource: ollama.fetchResource,
    });

    expect(
      await app.handleMessage(buildRpcMessage("ollama.enable", { name: "qwen3:4b" })),
    ).toMatchObject({
      type: "ollama.enabled",
      payload: { ref: `ollama:qwen3:4b@${ollama.chatDigest}` },
    });
    expect(ollama.state.pulls).toBe(1);
  });

  it("refuses a model that does not answer in the schema, at the checking stage", async () => {
    const ollama = createFakeOllama({ chatModels: ["qwen3:4b"], isChatBroken: true });
    const { app } = await createSessionApp({
      fetchResource: ollama.fetchResource,
    });

    expect(
      await app.handleMessage(buildRpcMessage("ollama.enable", { name: "qwen3:4b" })),
    ).toMatchObject({
      type: "ollama.enableFailed",
      payload: {
        stage: "checking",
        reason: expect.stringMatching(/^extracts products into a schema: 0 of 5/u),
      },
    });
  });

  it("times extraction from a page with the active generation model", async () => {
    const ollama = createFakeOllama({ chatModels: ["qwen3:4b"] });
    const { app } = await createSessionApp({
      fetchResource: ollama.fetchResource,
    });

    await app.handleMessage(buildRpcMessage("ollama.enable", { name: "qwen3:4b" }));

    expect(await app.handleMessage(buildRpcMessage("generation.measure", {}))).toMatchObject({
      type: "generation.measured",
      payload: {
        ref: `ollama:qwen3:4b@${ollama.chatDigest}`,
        isValid: true,
        correctCount: 5,
        expectedCount: 15,
        meetsBudget: true,
      },
    });
  });

  it("says page summaries are not on when no generation model is active", async () => {
    const { app } = await createSessionApp({
      fetchResource: createFakeOllama().fetchResource,
    });

    expect(await app.handleMessage(buildRpcMessage("generation.measure", {}))).toMatchObject({
      type: "generation.measureFailed",
      payload: { reason: expect.stringMatching(/^Page summaries are not on/u) },
    });
  });

  it("does not measure throughput for a generation model, and says where its measure is", async () => {
    const ollama = createFakeOllama({ chatModels: ["qwen3:4b"] });
    const { app } = await createSessionApp({
      fetchResource: ollama.fetchResource,
    });

    await app.handleMessage(buildRpcMessage("ollama.enable", { name: "qwen3:4b" }));

    expect(
      await app.handleMessage(
        buildRpcMessage("benchmark.run", { ref: `ollama:qwen3:4b@${ollama.chatDigest}` }),
      ),
    ).toMatchObject({
      type: "benchmark.failed",
      payload: { reason: expect.stringMatching(/measured by its extraction time/u) },
    });
  });

  it("holds the background loaded while extraction waits on the server, and lets go after", async () => {
    const slow = createFakeOllama({ chatModels: ["qwen3:4b"], chatDelayMs: 300 });
    const touch = vi.fn(() => Promise.resolve());
    const { app, database } = await createSessionApp({
      fetchResource: slow.fetchResource,
      backgroundLifetime: {
        touch,
        scheduleWake: () => Promise.resolve(),
        openHoldPage: () => Promise.reject(new Error("no tabs")),
        closeTab: () => Promise.resolve(),
      },
    });

    await app.handleMessage(buildRpcMessage("ollama.register", { name: "qwen3:4b" }));

    const registered = await database.get(MODEL_STORE, `ollama:qwen3:4b@${slow.chatDigest}`);

    if (registered === undefined) {
      throw new Error("The model was not registered.");
    }

    await database.put(MODEL_STORE, { ...registered, active: true, conformance: "passed" });
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

    try {
      const measured = app.handleMessage(buildRpcMessage("generation.measure", {}));

      await vi.waitFor(() => expect(vi.getTimerCount()).toBeGreaterThan(0));
      vi.advanceTimersByTime(10_000);
      expect(touch).toHaveBeenCalledTimes(2);

      expect(await measured).toMatchObject({ type: "generation.measured" });
      vi.advanceTimersByTime(60_000);
      expect(touch).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports progress every second while extraction runs", async () => {
    const slow = createFakeOllama({ chatModels: ["qwen3:4b"], chatDelayMs: 2_300 });
    const { app: slowApp, database } = await createSessionApp({
      fetchResource: slow.fetchResource,
    });

    // Registered and marked as having passed, rather than checked: the
    // checks would wait on the slow chat seven times.
    await slowApp.handleMessage(buildRpcMessage("ollama.register", { name: "qwen3:4b" }));

    const registered = await database.get(MODEL_STORE, `ollama:qwen3:4b@${slow.chatDigest}`);

    if (registered === undefined) {
      throw new Error("The model was not registered.");
    }

    await database.put(MODEL_STORE, { ...registered, active: true, conformance: "passed" });

    const { port, posted, send } = createFakePort();

    slowApp.attachPort(port);
    send(buildRpcMessage("generation.measure", {}));
    await vi.waitFor(
      () =>
        expect(posted.map((message) => (message as { type: string }).type)).toContain(
          "generation.measured",
        ),
      { timeout: 10_000 },
    );

    const types = posted.map((message) => (message as { type: string }).type);

    expect(types.filter((type) => type === "generation.measureProgress").length).toBeGreaterThan(1);
    expect(types.indexOf("generation.measureProgress")).toBeLessThan(
      types.indexOf("generation.measured"),
    );
  }, 15_000);
});

/**
 * A virtual clock for probe runs: `now` reads it, a probe's sleeps wait on it,
 * and `step` moves it on, also moving the faked intervals keep-alives use.
 */
const createProbeClock = () => {
  let clock = 1_000_000;
  const sleeps: { at: number; resolve: () => void }[] = [];

  return {
    now: () => clock,
    setTimer: (callback: () => void, delayMs: number) => {
      sleeps.push({ at: clock + delayMs, resolve: callback });
      return sleeps.length;
    },
    sleeping: () => sleeps.length,
    /** The page is unloaded: what it was waiting for never comes. */
    unload: () => {
      sleeps.splice(0);
    },
    step: (ms: number) => {
      clock += ms;
      vi.advanceTimersByTime(ms);

      for (const sleep of sleeps.splice(0).filter((pending) => {
        if (pending.at <= clock) {
          return true;
        }

        sleeps.push(pending);
        return false;
      })) {
        sleep.resolve();
      }
    },
  };
};

/** A background app on the real (fake-indexeddb) database, with no probes or jobs yet. */
const createProbeApp = async (overrides: Partial<BackgroundDependencies> = {}) => {
  const database = await openResearchDatabase();

  await Promise.all([database.clear(JOB_STORE), database.clear(HEARTBEAT_STORE)]);

  const clock = createProbeClock();
  const scheduleWake = vi.fn((_at: number | undefined) => Promise.resolve());
  const lifetime = {
    touch: vi.fn(() => Promise.resolve()),
    scheduleWake,
    openHoldPage: vi.fn(() => Promise.resolve(41)),
    closeTab: vi.fn((_tabId: number) => Promise.resolve()),
  };
  const create = () =>
    createBackgroundApp(
      buildDependencies({
        openDatabase: openResearchDatabase,
        now: clock.now,
        setTimer: clock.setTimer,
        backgroundLifetime: lifetime,
        ...overrides,
      }),
    );

  return { app: create(), create, database, clock, lifetime };
};

/** Steps the clock on, a beat at a time, until every job has settled. */
const stepUntilDone = async (
  clock: ReturnType<typeof createProbeClock>,
  database: Awaited<ReturnType<typeof openResearchDatabase>>,
) => {
  const isSettled = async () =>
    (await database.getAll(JOB_STORE)).every(
      ({ status }) => status === "done" || status === "failed",
    );

  for (let step = 0; step < 50 && !(await isSettled()); step += 1) {
    await vi.waitFor(async () => expect(clock.sleeping() > 0 || (await isSettled())).toBe(true));
    clock.step(2_000);
  }
};

const readProbes = async (app: BackgroundApp) =>
  (await app.handleMessage(buildRpcMessage("diagnostics.readProbes", {}))) as {
    payload: { runs: { state: string; strategy: string; pageLoads: number; lastSeenMs: number }[] };
  };

describe("the background-lifetime probe through the background", () => {
  it("answers a probe at once with its run id, then runs it to completion", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

    try {
      const { app, database, clock } = await createProbeApp();
      const answer = await app.handleMessage(
        buildRpcMessage("diagnostics.lifetimeProbe", { strategy: "none", holdMs: 5_000 }),
      );

      expect(answer).toMatchObject({
        type: "diagnostics.probeStarted",
        payload: { runId: expect.any(String) },
      });

      await stepUntilDone(clock, database);

      await vi.waitFor(async () =>
        expect((await readProbes(app)).payload.runs).toEqual([
          expect.objectContaining({ state: "completed", strategy: "none", pageLoads: 1 }),
        ]),
      );
      expect(await database.getAll(JOB_STORE)).toEqual([
        expect.objectContaining({ status: "done" }),
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("touches the browser while an API-activity run holds, and stops when it ends", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

    try {
      const { app, database, clock, lifetime } = await createProbeApp();

      await app.handleMessage(
        buildRpcMessage("diagnostics.lifetimeProbe", { strategy: "apiActivity", holdMs: 12_000 }),
      );
      await stepUntilDone(clock, database);

      const touches = lifetime.touch.mock.calls.length;

      expect(touches).toBeGreaterThanOrEqual(2);

      vi.advanceTimersByTime(60_000);
      expect(lifetime.touch).toHaveBeenCalledTimes(touches);
    } finally {
      vi.useRealTimers();
    }
  });

  it("holds a job-runner run the way every job is held", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

    try {
      const { app, database, clock, lifetime } = await createProbeApp();

      await app.handleMessage(
        buildRpcMessage("diagnostics.lifetimeProbe", { strategy: "jobRunner", holdMs: 12_000 }),
      );
      await stepUntilDone(clock, database);

      expect(lifetime.touch.mock.calls.length).toBeGreaterThanOrEqual(2);
      await vi.waitFor(async () =>
        expect((await readProbes(app)).payload.runs).toEqual([
          expect.objectContaining({ state: "completed", strategy: "jobRunner" }),
        ]),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens the hold page for a host-page run, posts to its port, and closes it", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

    try {
      const { app, database, clock, lifetime } = await createProbeApp();
      const holdPage = { ...createFakePort(), name: "hold" };

      app.attachPort({ ...holdPage.port, name: "hold" });
      await app.handleMessage(
        buildRpcMessage("diagnostics.lifetimeProbe", { strategy: "hostPage", holdMs: 6_000 }),
      );
      await stepUntilDone(clock, database);

      expect(lifetime.openHoldPage).toHaveBeenCalledTimes(1);
      expect(holdPage.posted).toContainEqual({ type: "hold.ping" });
      await vi.waitFor(() => expect(lifetime.closeTab).toHaveBeenCalledWith(41));
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not answer requests on the hold page's port", async () => {
    const { app } = await createProbeApp();
    const holdPage = createFakePort();

    app.attachPort({ ...holdPage.port, name: "hold" });
    holdPage.send(buildRpcMessage("inference.probe", {}));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(holdPage.posted).toEqual([]);
  });

  it("resumes a wake-and-resume run in the next page load, woken by the alarm", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

    try {
      const { app, create, database, clock } = await createProbeApp();

      await app.handleMessage(
        buildRpcMessage("diagnostics.lifetimeProbe", { strategy: "wakeAndResume", holdMs: 6_000 }),
      );
      await vi.waitFor(() => expect(clock.sleeping()).toBe(1));
      // The page is unloaded here: its sleep never ends, and its job stays running.
      clock.unload();
      expect((await database.getAll(JOB_STORE))[0]?.status).toBe("running");

      const woken = create();

      clock.step(61_000);
      void woken.handleAlarm("jobs.wake");
      await stepUntilDone(clock, database);

      await vi.waitFor(async () =>
        expect((await readProbes(woken)).payload.runs).toEqual([
          expect.objectContaining({ state: "resumed", pageLoads: 2 }),
        ]),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("ends another strategy's run where the unload stopped it, without resuming", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

    try {
      const { app, create, database, clock } = await createProbeApp();

      await app.handleMessage(
        buildRpcMessage("diagnostics.lifetimeProbe", { strategy: "none", holdMs: 6_000 }),
      );
      await vi.waitFor(() => expect(clock.sleeping()).toBe(1));
      clock.unload();

      const woken = create();

      clock.step(61_000);
      await woken.handleAlarm("jobs.wake");

      expect(await database.getAll(JOB_STORE)).toEqual([
        expect.objectContaining({ status: "done" }),
      ]);
      expect((await readProbes(woken)).payload.runs).toEqual([
        expect.objectContaining({ state: "stopped", lastSeenMs: 0, pageLoads: 1 }),
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sets the wake-up a minute ahead while a job runs, and clears it once none is left", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

    try {
      const { app, database, clock, lifetime } = await createProbeApp();
      const startedAt = clock.now();

      await app.handleMessage(
        buildRpcMessage("diagnostics.lifetimeProbe", { strategy: "none", holdMs: 2_000 }),
      );
      await vi.waitFor(() =>
        expect(lifetime.scheduleWake).toHaveBeenCalledWith(startedAt + 60_000),
      );
      await stepUntilDone(clock, database);

      await vi.waitFor(() => expect(lifetime.scheduleWake).toHaveBeenLastCalledWith(undefined));
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores an alarm that is not the job wake-up", async () => {
    const { app, database } = await createProbeApp();

    await database.put(JOB_STORE, {
      id: "left-running",
      type: "diagnostics.lifetimeProbe",
      inputHashes: ["r"],
      producerVersion: "probe@1",
      status: "running",
      priority: 0,
      attempts: 0,
      nextAttemptAt: 0,
      createdAt: 0,
      updatedAt: 0,
    });
    await app.handleAlarm("something.else");

    expect((await database.get(JOB_STORE, "left-running"))?.status).toBe("running");
  });

  it("refuses a probe hold outside the allowed range", async () => {
    const { app } = await createProbeApp();
    const answer = await app.handleMessage(
      buildRpcMessage("diagnostics.lifetimeProbe", { strategy: "none", holdMs: 10 }),
    );

    expect(answer).toMatchObject({ type: "rpc.refused" });
  });
});

/** A session app whose active generation model is Ollama's `qwen3:4b`, through the fake server. */
const createExtractionApp = async (overrides: Partial<BackgroundDependencies> = {}) => {
  const ollama = createFakeOllama({ chatModels: ["qwen3:4b"] });
  const signals = await createSignalsApp({
    fetchResource: ollama.fetchResource,
    ...overrides,
  });
  const { app, database } = signals;

  await Promise.all([database.clear(FACT_STORE), database.clear(EXTRACTION_STORE)]);
  await app.handleMessage(buildRpcMessage("ollama.register", { name: "qwen3:4b" }));

  const ref = `ollama:qwen3:4b@${ollama.chatDigest}`;
  const registered = await database.get(MODEL_STORE, ref);

  if (registered === undefined) {
    throw new Error("The model was not registered.");
  }

  // Marked as having passed rather than checked: the checks are not the subject here.
  await database.put(MODEL_STORE, { ...registered, active: true, conformance: "passed" });

  return { ...signals, ollama, ref };
};

/** Reads a page deeply, which stores its snapshot and queues its work. */
const readPageDeeply = async (app: BackgroundApp, clock: { focusedTabId: number | undefined }) => {
  await app.handleNavigationCommitted(commit("https://example.org/a"));
  clock.focusedTabId = 7;
  await app.handleTabActivated(7);
  await app.handleContentMessage(batch(0.3, 1), FROM_PAGE_A);
  await app.handleContentMessage(
    extracted("Mid-drive motors sit at the cranks. They weigh about three kilograms."),
    FROM_PAGE_A,
  );
};

const extractionJobs = async (database: Awaited<ReturnType<typeof openResearchDatabase>>) =>
  (await database.getAll(JOB_STORE)).filter(({ type }) => type === "extractFacts");

describe("fact extraction through the background", () => {
  it("extracts a deep-read page's grounded facts while the user is away", async () => {
    const { app, database, clock } = await createExtractionApp({
      readIdleState: () => Promise.resolve("idle"),
    });

    await readPageDeeply(app, clock);

    await vi.waitFor(async () =>
      expect((await database.getAll(EXTRACTION_STORE))[0]).toMatchObject({
        keptCount: 1,
        droppedCount: 1,
        finishedAt: expect.any(Number),
      }),
    );
    expect(await database.count(FACT_STORE)).toBe(1);
    expect((await extractionJobs(database))[0]?.status).toBe("done");
  });

  it("starts no extraction while the user is active, and other jobs still run", async () => {
    const embedding = createEmbeddingStub();
    const { app, database, clock } = await createExtractionApp({
      loadEmbeddingSession: embedding.load,
    });

    await database.put(MODEL_STORE, EMBEDDING_MODEL as never);
    await readPageDeeply(app, clock);

    await vi.waitFor(async () => expect(await database.count(VECTOR_STORE)).toBe(1));
    expect((await extractionJobs(database)).map(({ status }) => status)).toEqual(["queued"]);
    expect(await database.count(FACT_STORE)).toBe(0);
  });

  it("starts extraction once the user steps away", async () => {
    let state: "active" | "idle" = "active";
    const { app, database, clock } = await createExtractionApp({
      readIdleState: () => Promise.resolve(state),
    });

    await readPageDeeply(app, clock);
    await vi.waitFor(async () => expect(await extractionJobs(database)).toHaveLength(1));

    state = "idle";
    await app.handleIdleStateChanged("idle");

    await vi.waitFor(async () => expect(await database.count(FACT_STORE)).toBe(1));
  });

  it("extracts while the user is active once they ask for it", async () => {
    const { app, database, clock } = await createExtractionApp();

    await readPageDeeply(app, clock);
    await vi.waitFor(async () => expect(await extractionJobs(database)).toHaveLength(1));

    expect(await app.handleMessage(buildRpcMessage("facts.extractNow", {}))).toMatchObject({
      type: "facts.extractionStarted",
      payload: { queued: 1 },
    });
    await vi.waitFor(async () => expect(await database.count(FACT_STORE)).toBe(1));
  });

  it("runs the work held for the user's absence when they press run now, and only that work", async () => {
    const { app, database, clock } = await createExtractionApp();

    await readPageDeeply(app, clock);
    await vi.waitFor(async () => expect(await extractionJobs(database)).toHaveLength(1));

    expect(await app.handleMessage(buildRpcMessage("aiActivity.runNow", {}))).toMatchObject({
      type: "aiActivity.runStarted",
      payload: { marked: 1 },
    });
    await vi.waitFor(async () => expect(await database.count(FACT_STORE)).toBe(1));

    const [done] = await extractionJobs(database);

    await database.put(JOB_STORE, { ...done, id: "later", status: "queued", payload: {} } as never);

    await app.handleAlarm(JOB_WAKE_ALARM);

    expect((await database.get(JOB_STORE, "later"))?.status).toBe("queued");
  });

  it("answers that nothing was marked when no work is held", async () => {
    const { app } = await createExtractionApp();

    expect(await app.handleMessage(buildRpcMessage("aiActivity.runNow", {}))).toMatchObject({
      type: "aiActivity.runStarted",
      payload: { marked: 0 },
    });
  });

  it("runs a job a previous load marked as asked for, without a second request", async () => {
    const { app, database, clock } = await createExtractionApp();

    await readPageDeeply(app, clock);
    await vi.waitFor(async () => expect(await extractionJobs(database)).toHaveLength(1));

    const [job] = await extractionJobs(database);

    await database.put(JOB_STORE, {
      ...job,
      payload: { ...(job?.payload as object), requestedAt: 1 },
    } as never);
    await app.handleAlarm(JOB_WAKE_ALARM);

    await vi.waitFor(async () => expect(await database.count(FACT_STORE)).toBe(1));
  });

  it("resolves a page's entities once its extraction finishes", async () => {
    const { app, database, clock } = await createExtractionApp({
      readIdleState: () => Promise.resolve("idle"),
    });

    await database.clear(ENTITY_STORE);
    await readPageDeeply(app, clock);

    await vi.waitFor(async () => expect(await database.count(ENTITY_STORE)).toBe(1));
    await vi.waitFor(async () =>
      expect((await database.getAll(FACT_STORE))[0]?.entityId).toBe(
        (await database.getAll(ENTITY_STORE))[0]?.id,
      ),
    );
    expect(
      (await database.getAll(JOB_STORE)).find(({ type }) => type === "resolveEntities")?.status,
    ).toBe("done");
  });

  it("separates a merged entity on request", async () => {
    const { app, database } = await createExtractionApp();

    await database.put(ENTITY_STORE, {
      id: "neo",
      sessionId: "session-1",
      mergedInto: "air",
      isSeparated: false,
      keyId: "k",
      iv: new Uint8Array(12),
      encryptedEntity: new ArrayBuffer(1),
      createdAt: 1,
    });

    expect(
      await app.handleMessage(buildRpcMessage("entity.separate", { entityId: "neo" })),
    ).toMatchObject({ type: "entity.separated", payload: { entityId: "neo", separated: true } });
    expect((await database.get(ENTITY_STORE, "neo"))?.mergedInto).toBeUndefined();
  });

  it("summarises a cluster once its page's facts are in, while the user is away", async () => {
    const { app, database, clock } = await createExtractionApp({
      readIdleState: () => Promise.resolve("idle"),
    });

    await database.clear(SUMMARY_STORE);
    await readPageDeeply(app, clock);
    await vi.waitFor(async () => expect(await database.count(ENTITY_STORE)).toBeGreaterThan(0));
    await app.reconcileSession();

    await vi.waitFor(async () => expect(await database.count(SUMMARY_STORE)).toBe(1), {
      timeout: 5_000,
    });

    const view = await app.handleMessage(buildRpcMessage("summaries.read", {}));

    expect(view).toMatchObject({
      type: "summaries.view",
      payload: {
        session: {
          canSummarize: true,
          clusters: expect.arrayContaining([
            expect.objectContaining({
              factCount: 1,
              summary: expect.objectContaining({
                isStale: false,
                statements: [
                  {
                    text: "Mid-drive motors sit at the cranks.",
                    citations: [expect.objectContaining({ url: "https://example.org/a" })],
                  },
                ],
              }),
            }),
          ]),
        },
      },
    });
  });

  it("writes no summary while the user is active, until asked", async () => {
    const { app, database, clock } = await createExtractionApp();

    await database.clear(SUMMARY_STORE);
    await readPageDeeply(app, clock);
    await app.handleMessage(buildRpcMessage("facts.extractNow", {}));
    await vi.waitFor(async () => expect(await database.count(ENTITY_STORE)).toBeGreaterThan(0));
    await app.reconcileSession();

    expect(await database.count(SUMMARY_STORE)).toBe(0);

    const [cluster] = (await database.get(CLUSTERING_STORE, "session-1"))?.clusters ?? [];

    expect(
      await app.handleMessage(
        buildRpcMessage("summaries.refresh", { clusterId: cluster?.id ?? "" }),
      ),
    ).toMatchObject({ type: "summaries.refreshing", payload: { queued: true } });
    await vi.waitFor(async () => expect(await database.count(SUMMARY_STORE)).toBe(1), {
      timeout: 5_000,
    });
  });

  it("shows a summary as stale once its cluster's facts change", async () => {
    const { app, database, clock } = await createExtractionApp({
      readIdleState: () => Promise.resolve("idle"),
    });

    await database.clear(SUMMARY_STORE);
    await readPageDeeply(app, clock);
    await vi.waitFor(async () => expect(await database.count(ENTITY_STORE)).toBeGreaterThan(0));
    await app.reconcileSession();
    await vi.waitFor(async () => expect(await database.count(SUMMARY_STORE)).toBe(1), {
      timeout: 5_000,
    });

    const [fact] = await database.getAll(FACT_STORE);

    await database.put(FACT_STORE, { ...fact!, id: `${fact!.id}-more` });

    expect(await app.handleMessage(buildRpcMessage("summaries.read", {}))).toMatchObject({
      payload: {
        session: {
          clusters: expect.arrayContaining([
            expect.objectContaining({ summary: expect.objectContaining({ isStale: true }) }),
          ]),
        },
      },
    });
  });

  it("reads the comparison table from extracted facts, and keeps chosen columns", async () => {
    const { app, database, clock } = await createExtractionApp({
      readIdleState: () => Promise.resolve("idle"),
    });

    await readPageDeeply(app, clock);
    await vi.waitFor(async () => expect(await database.count(ENTITY_STORE)).toBeGreaterThan(0));
    await vi.waitFor(async () =>
      expect((await database.getAll(FACT_STORE)).every(({ entityId }) => entityId)).toBe(true),
    );

    const read = () => app.handleMessage(buildRpcMessage("table.read", {}));

    expect(await read()).toMatchObject({
      type: "table.view",
      payload: {
        title: "E-bike motors",
        table: {
          entityType: "product",
          columns: [{ key: "placement", label: "placement" }],
          rows: [{ name: "Motor", cells: { placement: { value: "x", isConflict: false } } }],
        },
      },
    });

    expect(
      await app.handleMessage(
        buildRpcMessage("table.setColumns", { entityType: "product", columns: ["missing"] }),
      ),
    ).toMatchObject({ type: "table.columnsSaved" });
    expect(await read()).toMatchObject({
      payload: { table: { columns: [], otherColumns: [{ key: "placement" }] } },
    });
  });

  it("reads the session's gaps, and opens a gap's search in the session's group", async () => {
    const createTab = vi.fn((_properties: { url?: string; active: boolean }) =>
      Promise.resolve({ id: 31 }),
    );
    const sessionTabs = createStubSessionTabs();
    const { app, clock } = await createExtractionApp({
      resumeApi: {
        createTab,
        groupTabs: () => Promise.resolve(42),
        updateGroup: () => Promise.resolve(),
        getGroup: () => Promise.resolve({ color: "blue" }),
        activateTab: () => Promise.resolve(),
        removeTab: () => Promise.resolve(),
      },
      sessionTabs,
    });

    await readPageDeeply(app, clock);

    expect(await app.handleMessage(buildRpcMessage("gaps.read", {}))).toMatchObject({
      type: "gaps.view",
      payload: {
        gaps: {
          cellGaps: [],
          // One page that declares no type: the session cannot tell which kinds are missing.
          categoryGaps: [],
        },
      },
    });
    expect(
      await app.handleMessage(buildRpcMessage("gaps.search", { query: "Motor review" })),
    ).toMatchObject({
      type: "gaps.searchOpened",
      payload: { url: "https://duckduckgo.com/?q=Motor%20review" },
    });
    expect(createTab).toHaveBeenCalledWith({
      url: "https://duckduckgo.com/?q=Motor%20review",
      active: true,
    });
    expect(sessionTabs.groupTabs).toHaveBeenCalledWith({ tabIds: [31], groupId: 42 });
  });

  it("rejects a fact, hiding it from the table, and restores it", async () => {
    const { app, database, clock } = await createExtractionApp({
      readIdleState: () => Promise.resolve("idle"),
    });

    await readPageDeeply(app, clock);
    await vi.waitFor(async () =>
      expect((await database.getAll(FACT_STORE)).some(({ entityId }) => entityId)).toBe(true),
    );

    const [fact] = await database.getAll(FACT_STORE);
    const rows = async () =>
      (
        (await app.handleMessage(buildRpcMessage("table.read", {}))) as {
          payload: { table: { rows: unknown[]; rejectedCount: number } };
        }
      ).payload.table;

    expect((await rows()).rows).toHaveLength(1);
    expect(
      await app.handleMessage(buildRpcMessage("facts.reject", { factIds: [fact!.id] })),
    ).toMatchObject({ type: "facts.rejected", payload: { rejectionCount: 1 } });
    expect(await rows()).toMatchObject({ rows: [], rejectedCount: 1 });
    expect(await app.handleMessage(buildRpcMessage("facts.restoreRejections", {}))).toMatchObject({
      type: "facts.rejectionsRestored",
      payload: { restoredCount: 1 },
    });
    expect((await rows()).rows).toHaveLength(1);
  });

  it("suggests open questions once facts settle while the user is away, and on request", async () => {
    const { app, database, clock } = await createExtractionApp({
      readIdleState: () => Promise.resolve("idle"),
    });

    await readPageDeeply(app, clock);
    await vi.waitFor(async () => expect(await database.count(QUESTION_STORE)).toBe(1), {
      timeout: 5_000,
    });
    expect(await app.handleMessage(buildRpcMessage("questions.read", {}))).toMatchObject({
      type: "questions.view",
      payload: {
        view: {
          questions: [{ question: "Is the motor serviceable?", query: "motor service" }],
          isStale: false,
        },
      },
    });
    expect(await app.handleMessage(buildRpcMessage("questions.refresh", {}))).toMatchObject({
      type: "questions.refreshing",
      payload: { queued: true },
    });
  });

  it("keeps a generation model's work through a swap to another model (REQ-LIN-005)", async () => {
    const { app, database, clock, ref } = await createExtractionApp({
      readIdleState: () => Promise.resolve("idle"),
    });

    await readPageDeeply(app, clock);
    await vi.waitFor(async () =>
      expect((await database.getAll(EXTRACTION_STORE))[0]?.finishedAt).toBeDefined(),
    );

    const first = await database.get(MODEL_STORE, ref);

    await database.put(MODEL_STORE, { ...first!, active: false });
    await database.put(MODEL_STORE, { ...first!, ref: "ollama:qwen3:8b@new", installedAt: 9 });
    await app.reconcileSession();

    expect((await extractionJobs(database)).map(({ producerVersion }) => producerVersion)).toEqual([
      expect.stringContaining(ref),
    ]);
  });

  it("opens the Summaries page", async () => {
    const openSummariesPage = vi.fn(() => Promise.resolve());
    const { app } = await createExtractionApp({ openSummariesPage });

    expect(await app.handleMessage(buildRpcMessage("summaries.open", {}))).toMatchObject({
      type: "summaries.opened",
    });
    expect(openSummariesPage).toHaveBeenCalledTimes(1);
  });

  it("queues no extraction without an active generation model", async () => {
    const { app, database, clock, ref } = await createExtractionApp({
      readIdleState: () => Promise.resolve("idle"),
    });
    const model = await database.get(MODEL_STORE, ref);

    await database.put(MODEL_STORE, { ...model!, active: false });
    await readPageDeeply(app, clock);
    await vi.waitFor(async () =>
      expect((await database.getAll(NODE_STORE))[0]?.snapshotId).toBeDefined(),
    );
    await app.reconcileSession();

    expect(await extractionJobs(database)).toEqual([]);
  });
});

/** The topics each `data.changed` a port has received names, oldest first. */
const readDataChanges = (posted: unknown[]) =>
  posted
    .filter((message) => (message as { type: string }).type === "data.changed")
    .map((message) => (message as { payload: { topics: string[] } }).payload.topics)
    .filter((topics) => topics.length > 0);

describe("telling pages that data changed", () => {
  it("answers a subscription with no topics, since the page reads for itself", async () => {
    const { app } = await createSessionApp();
    const page = createFakePort();

    app.attachPort(page.port);
    page.send(buildRpcMessage("data.subscribe", {}));

    await vi.waitFor(() =>
      expect(page.posted).toEqual([
        expect.objectContaining({ type: "data.changed", payload: { topics: [] } }),
      ]),
    );
  });

  it("tells a subscribed page that pages changed after a capture, without the data", async () => {
    const { app, database } = await createSessionApp({
      tabCapture: createTabCapture(sessionTab({ url: "https://example.org/a" })),
    });
    await database.put(SESSION_STORE, activeSession);

    const page = createFakePort();

    app.attachPort(page.port);
    page.send(buildRpcMessage("data.subscribe", {}));
    await vi.waitFor(() => expect(page.posted).toHaveLength(1));
    await app.handleNavigationCommitted(commit("https://example.org/a"));

    await vi.waitFor(() => expect(readDataChanges(page.posted)[0]).toEqual(["pages", "snapshots"]));
  });

  it("ends a burst of changes in one notification", async () => {
    const { app, database } = await createSessionApp({
      tabCapture: createTabCapture(sessionTab({ url: "https://example.org/a" })),
    });
    await database.put(SESSION_STORE, activeSession);

    const page = createFakePort();

    app.attachPort(page.port);
    page.send(buildRpcMessage("data.subscribe", {}));
    await vi.waitFor(() => expect(page.posted).toHaveLength(1));
    await Promise.all([
      app.handleNavigationCommitted(commit("https://example.org/a")),
      app.handleNavigationCommitted(commit("https://example.org/b")),
      app.handleNavigationCommitted(commit("https://example.org/c")),
    ]);
    await vi.waitFor(() => expect(readDataChanges(page.posted)).not.toHaveLength(0));

    expect(readDataChanges(page.posted)).toHaveLength(1);
  });

  it("tells every topic after a request that changes what pages show", async () => {
    const { app } = await createSessionApp();
    const page = createFakePort();

    app.attachPort(page.port);
    page.send(buildRpcMessage("data.subscribe", {}));
    await vi.waitFor(() => expect(page.posted).toHaveLength(1));
    await app.handleMessage(buildRpcMessage("node.delete", { nodeId: "missing" }));

    await vi.waitFor(() =>
      expect(new Set(readDataChanges(page.posted).flat())).toEqual(new Set(DATA_TOPICS)),
    );
  });

  it("does not answer a read with a notification, or it would answer itself", async () => {
    const { app } = await createSessionApp();
    const page = createFakePort();

    app.attachPort(page.port);
    page.send(buildRpcMessage("data.subscribe", {}));
    await vi.waitFor(() => expect(page.posted).toHaveLength(1));
    await app.handleMessage(buildRpcMessage("recorded.read", {}));
    await app.handleMessage(buildRpcMessage("summaries.read", {}));

    expect(readDataChanges(page.posted)).toEqual([]);
  });

  it("tells that access changed when the user grants or withdraws a permission", async () => {
    const { app } = await createSessionApp();
    const page = createFakePort();

    app.attachPort(page.port);
    page.send(buildRpcMessage("data.subscribe", {}));
    await vi.waitFor(() => expect(page.posted).toHaveLength(1));
    app.handleAccessChanged();

    await vi.waitFor(() => expect(readDataChanges(page.posted)[0]).toEqual(["access", "models"]));
  });

  it("stops telling a page whose port disconnected", async () => {
    const { app } = await createSessionApp();
    const page = createFakePort();

    app.attachPort(page.port);
    page.send(buildRpcMessage("data.subscribe", {}));
    await vi.waitFor(() => expect(page.posted).toHaveLength(1));
    page.disconnect();
    app.handleAccessChanged();
    await app.handleMessage(buildRpcMessage("recorded.read", {}));

    expect(readDataChanges(page.posted)).toEqual([]);
  });
});

/** A stored job for the activity strip's cases: queued and due, entered at time 1. */
const activityJob = (overrides: Partial<StoredJob> & { id: string }): StoredJob => ({
  type: "embedSnapshot",
  inputHashes: [overrides.id],
  producerVersion: "1",
  status: "queued",
  priority: 0,
  attempts: 0,
  nextAttemptAt: 0,
  createdAt: 1,
  queuedAt: 1,
  updatedAt: 1,
  ...overrides,
});

const readActivity = async (app: BackgroundApp) =>
  (await app.handleMessage(buildRpcMessage("aiActivity.read", {}))) as {
    type: string;
    payload: Record<string, unknown>;
  };

describe("what the local AI is doing, through the background", () => {
  it("is ready with what was done for the active session when nothing is pending", async () => {
    const { app, database } = await createSessionApp();

    await database.put(SESSION_STORE, activeSession);
    for (const id of ["a", "b"]) {
      await database.put(
        JOB_STORE,
        activityJob({ id, status: "done", sessionId: activeSession.id }),
      );
    }

    expect(await readActivity(app)).toMatchObject({
      type: "aiActivity.state",
      payload: { kind: "ready", totals: { pagesRead: 2 }, failed: 0 },
    });
  });

  it("names the running work and how far the batch has got", async () => {
    const { app, database } = await createSessionApp();

    await database.put(JOB_STORE, activityJob({ id: "done", status: "done", updatedAt: 5 }));
    await database.put(
      JOB_STORE,
      activityJob({ id: "run", status: "running", type: "extractFacts", updatedAt: 9 }),
    );
    await database.put(JOB_STORE, activityJob({ id: "next" }));

    expect((await readActivity(app)).payload).toEqual({
      kind: "working",
      label: "Extracting facts",
      settled: 1,
      total: 3,
      startedAt: 9,
      failed: 0,
    });
  });

  it("waits for the user while only text generation is queued and they are active", async () => {
    const { app, database } = await createSessionApp();

    await database.put(JOB_STORE, activityJob({ id: "facts", type: "extractFacts" }));

    expect((await readActivity(app)).payload).toEqual({ kind: "waiting", waiting: 1, failed: 0 });
  });

  it("works on held-back generation once the user is away", async () => {
    const { app, database } = await createSessionApp({
      readIdleState: () => Promise.resolve("idle"),
    });

    await database.put(JOB_STORE, activityJob({ id: "facts", type: "extractFacts" }));

    expect((await readActivity(app)).payload).toMatchObject({
      kind: "working",
      label: "Extracting facts",
    });
  });

  it("is paused while Ollama does not answer and work waits", async () => {
    const { app, database } = await createSessionApp();

    await database.put(MODEL_STORE, {
      ref: "ollama:nomic-embed-text:latest@abc",
      active: true,
      conformance: "passed",
      installedAt: 1,
      manifest: { reference: { hub: "ollama" }, contract: { family: "embedding" } },
    } as never);
    await database.put(
      JOB_STORE,
      activityJob({
        id: "stuck",
        attempts: 1,
        nextAttemptAt: Number.MAX_SAFE_INTEGER,
        failureReason: "Ollama is not running at http://127.0.0.1:11434.",
      }),
    );

    expect((await readActivity(app)).payload).toEqual({ kind: "paused", waiting: 1, failed: 0 });
  });

  it("tells subscribed pages that jobs changed as a job is claimed and settled", async () => {
    const { app, database } = await createSessionApp();
    const page = createFakePort();

    app.attachPort(page.port);
    page.send(buildRpcMessage("data.subscribe", {}));
    await vi.waitFor(() => expect(page.posted).toHaveLength(1));

    // A type with no runner: claimed, then failed into a retry, which settles the attempt.
    await database.put(JOB_STORE, activityJob({ id: "orphan", type: "noRunner" }));
    await app.handleAlarm("jobs.wake");

    await vi.waitFor(async () =>
      expect((await database.get(JOB_STORE, "orphan"))?.attempts).toBe(1),
    );
    await vi.waitFor(() => expect(readDataChanges(page.posted).flat()).toContain("jobs"));
  });

  it("tells subscribed pages that jobs changed when the user steps away or back", async () => {
    const { app } = await createSessionApp();
    const page = createFakePort();

    app.attachPort(page.port);
    page.send(buildRpcMessage("data.subscribe", {}));
    await vi.waitFor(() => expect(page.posted).toHaveLength(1));
    await app.handleIdleStateChanged("active");

    await vi.waitFor(() => expect(readDataChanges(page.posted).flat()).toContain("jobs"));
  });
});

/**
 * A job that stopped because Ollama did not answer: out of retries, or waiting
 * out its backoff. It names no snapshot, so a rerun fails for a reason of its own.
 */
const stuckJob = (isOutOfRetries = true) =>
  activityJob({
    id: "stuck",
    ...(isOutOfRetries
      ? { status: "failed", attempts: 4 }
      : { attempts: 1, nextAttemptAt: Number.MAX_SAFE_INTEGER }),
    failureReason: "Ollama is not running at http://127.0.0.1:11434.",
  });

describe("a pause that is over, through the background", () => {
  it("hands paused work back once AI is turned on, since Ollama has just answered", async () => {
    const ollama = createFakeOllama({ hasModel: false, chatModels: ["qwen3:4b"] });
    const { app, database } = await createSessionApp({ fetchResource: ollama.fetchResource });

    await database.put(JOB_STORE, stuckJob());

    expect(await app.handleMessage(buildRpcMessage("aiSetup.turnOn", {}))).toMatchObject({
      type: "aiSetup.turnedOn",
    });
    await vi.waitFor(async () =>
      expect((await database.get(JOB_STORE, "stuck"))?.failureReason).not.toMatch(/^Ollama/u),
    );
    expect((await readActivity(app)).payload).not.toMatchObject({ kind: "paused" });
  });

  it("asks Ollama again when the popup reads a pause, and resumes if it is back", async () => {
    const ollama = createFakeOllama();
    const { app, database } = await createSessionApp({ fetchResource: ollama.fetchResource });

    await database.put(MODEL_STORE, {
      ref: "ollama:nomic-embed-text:latest@abc",
      active: true,
      conformance: "passed",
      installedAt: 1,
      manifest: { reference: { hub: "ollama" }, contract: { family: "embedding" } },
    } as never);
    await database.put(JOB_STORE, stuckJob(false));

    expect((await readActivity(app)).payload).toMatchObject({ kind: "paused" });
    await vi.waitFor(async () =>
      expect((await database.get(JOB_STORE, "stuck"))?.failureReason).not.toMatch(/^Ollama/u),
    );
    expect((await readActivity(app)).payload).not.toMatchObject({ kind: "paused" });
  });

  it("stays paused while Ollama is still not answering", async () => {
    const ollama = createFakeOllama({ isRunning: false });
    const { app, database } = await createSessionApp({ fetchResource: ollama.fetchResource });

    await database.put(MODEL_STORE, {
      ref: "ollama:nomic-embed-text:latest@abc",
      active: true,
      conformance: "passed",
      installedAt: 1,
      manifest: { reference: { hub: "ollama" }, contract: { family: "embedding" } },
    } as never);
    await database.put(JOB_STORE, stuckJob(false));

    expect((await readActivity(app)).payload).toMatchObject({ kind: "paused" });
    await vi.waitFor(() => expect(ollama.fetchResource).toHaveBeenCalled());
    expect((await readActivity(app)).payload).toMatchObject({ kind: "paused" });
  });
});
