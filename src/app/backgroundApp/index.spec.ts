import { describe, expect, it, vi } from "vitest";

import "fake-indexeddb/auto";

import { createBackgroundApp, type BackgroundDependencies } from ".";
import type { InferenceWorker } from "@/features/inference";
import type { TabGroupApi } from "@/features/tabGroups";
import { getFileDigest } from "@/features/modelInstall/model/assertFileDigest/utils/getFileDigest";
import { MINILM_L6_V2 } from "@/shared/config";
import { buildRpcMessage } from "@/shared/rpc";
import {
  MODEL_FILE_STORE,
  MODEL_STORE,
  openResearchDatabase,
  SESSION_STORE,
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
    persistStorage: () => Promise.resolve(true),
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

  return database;
};

/** A stand-in for a runtime port, capturing what the background posts back. */
const createFakePort = () => {
  const listeners: ((message: unknown) => void)[] = [];
  const posted: unknown[] = [];

  return {
    posted,
    port: {
      postMessage: (message: unknown) => posted.push(message),
      onMessage: {
        addListener: (listener: (message: unknown) => void) => listeners.push(listener),
      },
    },
    send: (message: unknown) => {
      for (const listener of listeners) {
        listener(message);
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
      payload: { session: { id: "session-1", title: "E-bike motors", groupId: 42 } },
    });
    expect(await app.handleMessage(buildRpcMessage("session.getActive", {}))).toMatchObject({
      type: "session.active",
      payload: { session: null },
    });
  });

  it("ends the session when the user removes its group", async () => {
    const { app, database } = await createSessionApp();
    await database.put(SESSION_STORE, activeSession);

    await app.handleGroupRemoved({ id: 42 }, { isWindowClosing: false });

    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({ status: "saved" });
  });

  it("keeps the session when its group goes because the window is closing", async () => {
    const { app, database } = await createSessionApp();
    await database.put(SESSION_STORE, activeSession);

    await app.handleGroupRemoved({ id: 42 }, { isWindowClosing: true });

    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({ status: "active" });
  });

  it("renames the session with its group", async () => {
    const { app, database } = await createSessionApp();
    await database.put(SESSION_STORE, activeSession);

    await app.handleGroupUpdated({ id: 42, title: "Mid-drive motors" });

    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({
      title: "Mid-drive motors",
    });
  });

  it("ends a session whose group did not come back after a restart", async () => {
    const { app, database } = await createSessionApp({
      tabGroups: createStubTabGroups({
        getGroup: vi.fn().mockRejectedValue(new Error("No group with id: 42")),
      }),
    });
    await database.put(SESSION_STORE, activeSession);

    await app.reconcileSession();

    expect(await database.get(SESSION_STORE, "session-1")).toMatchObject({ status: "saved" });
  });
});
