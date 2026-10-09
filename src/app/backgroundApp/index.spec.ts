import { describe, expect, it, vi } from "vitest";

import "fake-indexeddb/auto";

import { createBackgroundApp, type BackgroundDependencies } from ".";
import type { InferenceWorker } from "@/features/inference";
import { getFileDigest } from "@/features/modelInstall/model/assertFileDigest/utils/getFileDigest";
import { MINILM_L6_V2 } from "@/shared/config/modelProfiles";
import { buildRpcMessage } from "@/shared/rpc";
import { MODEL_FILE_STORE, MODEL_STORE, openModelDatabase } from "@/shared/storage";

const pong = { availableDevices: ["wasm"] as const, crossOriginIsolated: false, threadCount: 1 };

const stubWorker = (overrides: Partial<InferenceWorker> = {}): InferenceWorker => {
  return {
    request: vi.fn().mockResolvedValue(buildRpcMessage("worker.pong", pong)),
    terminate: vi.fn(),
    ...overrides,
  };
};

/** Dependencies with inert defaults, so a test names only what it cares about. */
const deps = (overrides: Partial<BackgroundDependencies> = {}): BackgroundDependencies => {
  return {
    createInferenceWorker: () => stubWorker(),
    openDatabase: () => Promise.reject(new Error("no database in this test")),
    fetchResource: (() => Promise.reject(new Error("no network in this test"))) as typeof fetch,
    policyViolations: { read: () => [] },
    ...overrides,
  };
};

const encode = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

/** A worker that fails every load, as a poisoned runtime would. */
const failingWorker = () => {
  return stubWorker({
    request: vi.fn((type: string) =>
      type === "model.load"
        ? Promise.reject(new Error("no available backend found"))
        : Promise.resolve(buildRpcMessage("worker.pong", pong)),
    ) as unknown as InferenceWorker["request"],
  });
};

/** An empty database, so one test's installs cannot be seen by the next. */
const freshDatabase = async () => {
  const database = await openModelDatabase();

  await database.clear(MODEL_STORE);
  await database.clear(MODEL_FILE_STORE);

  return database;
};

/** A stand-in for a runtime port, capturing what the background posts back. */
const fakePort = () => {
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
    const app = createBackgroundApp(deps());

    const response = await app.handleMessage(buildRpcMessage("inference.probe", {}));

    expect(response).toMatchObject({ type: "inference.capabilities", payload: pong });
  });

  it("starts no worker until something is actually asked of it", () => {
    const createInferenceWorker = vi.fn(() => stubWorker());

    createBackgroundApp(deps({ createInferenceWorker }));

    expect(createInferenceWorker).not.toHaveBeenCalled();
  });

  it("reuses one worker across requests, rather than spawning per message", async () => {
    const createInferenceWorker = vi.fn(() => stubWorker());
    const app = createBackgroundApp(deps({ createInferenceWorker }));

    await app.handleMessage(buildRpcMessage("inference.probe", {}));
    await app.handleMessage(buildRpcMessage("inference.probe", {}));

    expect(createInferenceWorker).toHaveBeenCalledTimes(1);
  });

  it("refuses a message type it does not handle", async () => {
    const app = createBackgroundApp(deps());

    const response = await app.handleMessage(buildRpcMessage("session.start", {}));

    expect(response).toMatchObject({ type: "inference.failed" });
    expect(response.payload).toMatchObject({ reason: expect.stringContaining("session.start") });
  });

  it("refuses something that is not an envelope at all", async () => {
    const app = createBackgroundApp(deps());

    expect(await app.handleMessage("nonsense")).toMatchObject({ type: "inference.failed" });
  });

  it("reports a worker failure as a reason rather than throwing at the surface", async () => {
    const worker = stubWorker({
      request: vi.fn().mockRejectedValue(new Error("worker crashed")),
    });
    const app = createBackgroundApp(deps({ createInferenceWorker: () => worker }));

    const response = await app.handleMessage(buildRpcMessage("inference.probe", {}));

    expect(response).toMatchObject({ type: "inference.failed" });
    expect(response.payload).toMatchObject({ reason: expect.stringContaining("worker crashed") });
  });

  it("reports an unexpected worker response instead of passing it on", async () => {
    const worker = stubWorker({
      request: vi
        .fn()
        .mockResolvedValue(
          buildRpcMessage("worker.error", { requestType: "worker.ping", reason: "bad" }),
        ),
    });
    const app = createBackgroundApp(deps({ createInferenceWorker: () => worker }));

    const response = await app.handleMessage(buildRpcMessage("inference.probe", {}));

    expect(response).toMatchObject({ type: "inference.failed" });
  });

  it("releases the worker on shutdown", async () => {
    const worker = stubWorker();
    const app = createBackgroundApp(deps({ createInferenceWorker: () => worker }));

    await app.handleMessage(buildRpcMessage("inference.probe", {}));
    app.shutdown();

    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("shuts down safely when no worker was ever started", () => {
    const app = createBackgroundApp(deps());

    expect(() => app.shutdown()).not.toThrow();
  });

  describe("over a port", () => {
    it("answers a request on the same port it arrived on", async () => {
      const app = createBackgroundApp(deps());
      const { port, posted, send } = fakePort();

      app.attachPort(port);
      send(buildRpcMessage("inference.probe", {}));
      await vi.waitFor(() => expect(posted).toHaveLength(1));

      expect(posted[0]).toMatchObject({ type: "inference.capabilities", payload: pong });
    });

    it("answers each of several requests on one port", async () => {
      const app = createBackgroundApp(deps());
      const { port, posted, send } = fakePort();

      app.attachPort(port);
      send(buildRpcMessage("inference.probe", {}));
      send(buildRpcMessage("inference.probe", {}));
      await vi.waitFor(() => expect(posted).toHaveLength(2));

      expect(
        posted.every((message) => (message as { type: string }).type === "inference.capabilities"),
      ).toBe(true);
    });

    it("reports a refusal over the port rather than staying silent", async () => {
      const app = createBackgroundApp(deps());
      const { port, posted, send } = fakePort();

      app.attachPort(port);
      send("nonsense");
      await vi.waitFor(() => expect(posted).toHaveLength(1));

      expect(posted[0]).toMatchObject({ type: "inference.failed" });
    });

    it("serves two ports independently", async () => {
      const app = createBackgroundApp(deps());
      const first = fakePort();
      const second = fakePort();

      app.attachPort(first.port);
      app.attachPort(second.port);
      first.send(buildRpcMessage("inference.probe", {}));
      await vi.waitFor(() => expect(first.posted).toHaveLength(1));

      expect(second.posted).toHaveLength(0);
    });
  });

  it("starts a fresh worker after a shutdown", async () => {
    const createInferenceWorker = vi.fn(() => stubWorker());
    const app = createBackgroundApp(deps({ createInferenceWorker }));

    await app.handleMessage(buildRpcMessage("inference.probe", {}));
    app.shutdown();
    await app.handleMessage(buildRpcMessage("inference.probe", {}));

    expect(createInferenceWorker).toHaveBeenCalledTimes(2);
  });
});

describe("installing a model through the background", () => {
  const configJson = '{"model_type":"bert","hidden_size":384,"max_position_embeddings":512}';
  const tokenizerConfigJson = '{"model_max_length":512}';

  const bodyFor = (path: string) =>
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
        size: new TextEncoder().encode(bodyFor(path)).byteLength,
        lfs: { oid: await getFileDigest(encode(bodyFor(path)), "sha256") },
      })),
    );
  };

  const stubHubFetch = (tree: unknown, corrupt = false) => {
    return vi.fn((rawUrl: string) => {
      const url = String(rawUrl);

      if (url.includes("/tree/")) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(tree) });
      }

      const path = [...MINILM_L6_V2.files, "tokenizer_config.json"].find((candidate) =>
        url.endsWith(`/${candidate}`),
      );
      const text = corrupt && path?.endsWith(".onnx") ? "tampered" : bodyFor(path ?? "");

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

    createBackgroundApp(deps({ fetchResource, openDatabase }));

    expect(fetchResource).not.toHaveBeenCalled();
    expect(openDatabase).not.toHaveBeenCalled();
  });

  it("installs a bundled profile and reports where it landed", async () => {
    const database = await freshDatabase();
    const app = createBackgroundApp(
      deps({
        openDatabase: () => Promise.resolve(database),
        fetchResource: stubHubFetch(await buildTree()),
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
    const app = createBackgroundApp(deps());

    const response = await app.handleMessage(
      buildRpcMessage("model.install", { repository: "someone/untrusted-model" }),
    );

    expect(response).toMatchObject({ type: "model.installFailed" });
    expect(response.payload).toMatchObject({
      reason: expect.stringContaining("someone/untrusted-model"),
    });
  });

  it("reports an install failure as a reason rather than throwing", async () => {
    const database = await freshDatabase();
    const app = createBackgroundApp(
      deps({
        openDatabase: () => Promise.resolve(database),
        fetchResource: stubHubFetch(await buildTree(), true),
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
    const database = await freshDatabase();
    const app = createBackgroundApp(
      deps({
        openDatabase: () => Promise.resolve(database),
        fetchResource: stubHubFetch(await buildTree()),
      }),
    );
    const { port, posted, send } = fakePort();

    app.attachPort(port);
    send(buildRpcMessage("model.install", { repository: MINILM_L6_V2.repository }));

    await vi.waitFor(() => expect(posted.at(-1)).toMatchObject({ type: "model.installed" }));

    const types = posted.map((message) => (message as { type: string }).type);

    expect(types.filter((type) => type === "model.installProgress").length).toBeGreaterThan(0);
    expect(types.at(-1)).toBe("model.installed");
  });

  it("still answers a one-shot install, dropping the progress it cannot stream", async () => {
    const database = await freshDatabase();
    const app = createBackgroundApp(
      deps({
        openDatabase: () => Promise.resolve(database),
        fetchResource: stubHubFetch(await buildTree()),
      }),
    );

    await expect(
      app.handleMessage(buildRpcMessage("model.install", { repository: MINILM_L6_V2.repository })),
    ).resolves.toMatchObject({ type: "model.installed" });
  });

  it("opens the database once across several installs", async () => {
    const database = await freshDatabase();
    const openDatabase = vi.fn(() => Promise.resolve(database));
    const app = createBackgroundApp(
      deps({ openDatabase, fetchResource: stubHubFetch(await buildTree()) }),
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

  const databaseWithModel = async () => {
    const database = await freshDatabase();

    await database.put(MODEL_STORE, installed as never);
    await database.put(MODEL_FILE_STORE, {
      ref: installed.ref,
      path: "config.json",
      contents: encode("{}"),
    });

    return database;
  };

  it("starts a fresh worker when the compute path changes", async () => {
    const workers = [failingWorker(), failingWorker()];
    const createInferenceWorker = vi.fn(() => workers.shift() ?? failingWorker());
    const database = await databaseWithModel();
    const app = createBackgroundApp(
      deps({ createInferenceWorker, openDatabase: () => Promise.resolve(database) }),
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
    const createInferenceWorker = vi.fn(() => failingWorker());
    const database = await databaseWithModel();
    const app = createBackgroundApp(
      deps({ createInferenceWorker, openDatabase: () => Promise.resolve(database) }),
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
    const database = await databaseWithModel();
    const app = createBackgroundApp(
      deps({
        createInferenceWorker: () => failingWorker(),
        openDatabase: () => Promise.resolve(database),
      }),
    );

    const response = await app.handleMessage(
      buildRpcMessage("model.activate", { ref: installed.ref, device: "wasm" }),
    );

    expect(response.type).toBe("model.activationFailed");
  });

  it("keeps one worker while the path stays the same and loads succeed", async () => {
    const createInferenceWorker = vi.fn(() => stubWorker());
    const app = createBackgroundApp(deps({ createInferenceWorker }));

    await app.handleMessage(buildRpcMessage("inference.probe", {}));
    await app.handleMessage(buildRpcMessage("inference.probe", {}));

    expect(createInferenceWorker).toHaveBeenCalledTimes(1);
  });
});
