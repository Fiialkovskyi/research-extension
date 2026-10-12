import { describe, expect, it, vi } from "vitest";

import "fake-indexeddb/auto";

import { type BackgroundApp, createBackgroundApp, type BackgroundDependencies } from ".";
import type { InferenceWorker } from "@/features/inference";
import { SESSION_TAB_VALUE_KEY, type SessionTabApi } from "@/features/researchSession";
import type { CaptureTab, TabCaptureApi } from "@/features/tabCapture";
import type { TabGroupApi } from "@/features/tabGroups";
import { getFileDigest } from "@/features/modelInstall/model/assertFileDigest/utils/getFileDigest";
import { MINILM_L6_V2 } from "@/shared/config";
import { buildRpcMessage } from "@/shared/rpc";
import {
  CHUNK_STORE,
  CLUSTERING_STORE,
  EDGE_STORE,
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
    pageSignals: {
      executeScript: () => Promise.resolve([]),
      requestPageText: () => Promise.resolve(undefined),
      requestFlush: () => Promise.resolve(undefined),
    },
    readFocusedTab: () => Promise.resolve(undefined),
    resumeApi: {
      createTab: () => Promise.reject(new Error("no tabs in this test")),
      groupTabs: () => Promise.reject(new Error("no groups in this test")),
      updateGroup: () => Promise.resolve(),
      getGroup: () => Promise.reject(new Error("no groups in this test")),
      activateTab: () => Promise.resolve(),
      removeTab: () => Promise.resolve(),
    },
    closeTabs: {
      queryWindowTabIds: () => Promise.resolve([]),
      createTabIn: () => Promise.resolve(),
      removeTabs: () => Promise.resolve(),
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

  it("refuses a second session without opening a tab, naming the active one", async () => {
    const tabGroups = createStubTabGroups({
      getGroup: vi.fn().mockResolvedValue({ color: "blue", title: "E-bike motors" }),
    });
    const { app, database } = await createSessionApp({ tabGroups });
    await database.put(SESSION_STORE, activeSession);

    const response = await app.handleMessage(
      buildRpcMessage("tabGroup.create", { title: "Batteries" }),
    );

    expect(response).toMatchObject({
      type: "tabGroup.failed",
      payload: { reason: 'A session is already active: "E-bike motors".' },
    });
    expect(tabGroups.createTab).not.toHaveBeenCalled();
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
        session: { id: "session-1", title: "E-bike motors", groupId: 42, pageCount: 0 },
      },
    });
    expect(await app.handleMessage(buildRpcMessage("session.getActive", {}))).toMatchObject({
      type: "session.active",
      payload: { session: null, closedSession: { id: "session-1" } },
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

  it("reports a closed session beside no active one", async () => {
    const { app, database } = await createSessionApp({
      tabGroups: createStubTabGroups({
        getGroup: vi.fn().mockRejectedValue(new Error("No group with id: 42")),
      }),
    });
    await database.put(SESSION_STORE, { ...activeSession, status: "closed" });

    expect(await app.handleMessage(buildRpcMessage("session.getActive", {}))).toMatchObject({
      type: "session.active",
      payload: {
        session: null,
        closedSession: { id: "session-1", title: "E-bike motors", groupId: 42 },
      },
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
      payload: { session: { pageCount: 2 } },
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

  it("opens the map when asked", async () => {
    const openMap = vi.fn(() => Promise.resolve());
    const app = createBackgroundApp(buildDependencies({ openMap }));

    const response = await app.handleMessage(buildRpcMessage("map.open", {}));

    expect(response).toMatchObject({ type: "map.opened" });
    expect(openMap).toHaveBeenCalledTimes(1);
  });
});

/** A batch as a session page's observer sends it. */
const batch = (maxScroll: number, copyEvents = 0) =>
  buildRpcMessage("signal.batch", { maxScroll, copyEvents });

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
  const { app, database } = await createSessionApp({
    tabCapture: createTabCapture(sessionTab(), sessionTab({ id: 8, url: "https://example.org/c" })),
    pageSignals: { executeScript, requestPageText, requestFlush },
    readFocusedTab: () => Promise.resolve(clock.focusedTabId),
    now: () => clock.now,
    ...overrides,
  });

  await database.put(SESSION_STORE, activeSession);

  return { app, database, clock, executeScript, requestPageText, requestFlush };
};

const readNodeByUrl = async (
  database: Awaited<ReturnType<typeof createFreshDatabase>>,
  url: string,
) => (await database.getAll(NODE_STORE)).find((node) => node.url === url);

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

  it("neither records, observes nor times a denylisted page in a session tab", async () => {
    const { app, database, clock, executeScript } = await createSignalsApp();

    await app.handleNavigationCommitted(commit("https://www.paypal.com/myaccount"));
    clock.focusedTabId = 7;
    await app.handleTabActivated(7);
    clock.now += 60_000;
    clock.focusedTabId = 8;
    await app.handleTabActivated(8);

    expect(await database.count(NODE_STORE)).toBe(0);
    expect(executeScript).not.toHaveBeenCalled();
    expect(
      await app.handleContentMessage(batch(0.9, 1), {
        tabId: 7,
        url: "https://www.paypal.com/myaccount",
      }),
    ).toMatchObject({ type: "signal.dropped", payload: { stop: true } });
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
  let next = 0;

  return {
    armed: () => next,
    pending: () => pending.size,
    fire: () => {
      const due = [...pending.values()];

      pending.clear();
      due.forEach((callback) => {
        callback();
      });
    },
    setTimer: (callback: () => void) => {
      next += 1;
      pending.set(next, callback);
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

    expect(timer.pending()).toBe(1);
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

    expect((await database.get(SESSION_STORE, "session-1"))?.activeEmbeddingSpaceId).toBe(
      space?.id,
    );
    expect(await database.getAll(JOB_STORE)).toEqual([expect.objectContaining({ status: "done" })]);
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
    await vi.waitFor(() => expect(timer.pending()).toBe(1));

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
      payload: { session: null, closedSession: null },
    });
  });

  it("opens the page through its dependency", async () => {
    const openRecordedPage = vi.fn(() => Promise.resolve());
    const { app } = await createSessionApp({ openRecordedPage });

    expect(await app.handleMessage(buildRpcMessage("recorded.open", {}))).toMatchObject({
      type: "recorded.opened",
    });
    expect(openRecordedPage).toHaveBeenCalledTimes(1);
  });
});

describe("saving and resuming through the background", () => {
  it("saves the session with the scroll its page sends when asked, and closes its tabs", async () => {
    const holder: { app?: BackgroundApp } = {};
    const removeTabs = vi.fn((_ids: number[]) => Promise.resolve());
    const signals = await createSignalsApp({
      tabCapture: {
        ...createTabCapture(sessionTab(), sessionTab({ id: 8, url: "https://example.org/c" })),
        queryGroupTabs: vi.fn(async () => [
          { ...sessionTab(), windowId: 1 },
          { ...sessionTab({ id: 8, url: "https://example.org/c" }), windowId: 1 },
        ]),
      },
      closeTabs: {
        queryWindowTabIds: () => Promise.resolve([1, 7, 8]),
        createTabIn: () => Promise.resolve(),
        removeTabs,
      },
    });
    const { app, database, clock } = signals;

    holder.app = app;
    signals.requestFlush.mockImplementation(async (tabId: number) => {
      if (tabId === 7) {
        await holder.app?.handleContentMessage(batch(0.9), FROM_PAGE_A);
      }
    });
    await app.handleNavigationCommitted(commit("https://example.org/a"));
    await app.handleNavigationCommitted({ ...commit("https://example.org/c"), tabId: 8 });
    clock.focusedTabId = 7;
    await app.handleTabActivated(7);

    expect(await app.handleMessage(buildRpcMessage("session.save", {}))).toMatchObject({
      type: "session.saved",
      payload: { sessionId: "session-1" },
    });

    const session = await database.get(SESSION_STORE, "session-1");
    const nodeA = await readNodeByUrl(database, "https://example.org/a");

    expect(session).toMatchObject({
      status: "saved",
      savedTabs: [
        expect.objectContaining({ url: "https://example.org/a" }),
        expect.objectContaining({ url: "https://example.org/c" }),
      ],
      lastPosition: expect.objectContaining({ nodeId: nodeA?.id, readFraction: 0.9 }),
    });
    expect(nodeA?.signals.maxScroll).toBe(0.9);
    expect(removeTabs).toHaveBeenCalledWith([7, 8]);
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

  it("refuses to resume while a session is active", async () => {
    const { app, database } = await createSignalsApp({
      resumeApi: {
        createTab: vi.fn(() => Promise.resolve({ id: 1 })),
        groupTabs: vi.fn(() => Promise.resolve(77)),
        updateGroup: vi.fn(() => Promise.resolve()),
        getGroup: vi.fn(() => Promise.resolve({ color: "blue" })),
        activateTab: vi.fn(() => Promise.resolve()),
        removeTab: vi.fn(() => Promise.resolve()),
      },
    });

    await database.put(SESSION_STORE, { ...activeSession, id: "session-0", status: "saved" });

    expect(
      await app.handleMessage(buildRpcMessage("session.resume", { sessionId: "session-0" })),
    ).toMatchObject({
      type: "session.resumeFailed",
      payload: { reason: expect.stringContaining("already active") },
    });
  });
});
