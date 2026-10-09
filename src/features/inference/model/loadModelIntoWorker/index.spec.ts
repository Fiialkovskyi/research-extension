import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadModelIntoWorker } from ".";
import type { ModelManifest } from "@/shared/modelManifest";
import { buildRpcMessage } from "@/shared/rpc";
import {
  MODEL_FILE_STORE,
  type ModelDatabaseSchema,
  openModelDatabase,
  type StoredModel,
} from "@/shared/storage";
import type { InferenceWorker } from "../createInferenceWorker";

const encode = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

const manifest: ModelManifest = {
  manifestVersion: 1,
  reference: { hub: "huggingface", repository: "owner/model", revision: "a".repeat(40) },
  format: "onnx",
  quantization: "q8",
  files: [
    { path: "config.json", digest: { algorithm: "sha256", value: "a".repeat(64) }, bytes: 2 },
    {
      path: "onnx/model_quantized.onnx",
      digest: { algorithm: "sha256", value: "b".repeat(64) },
      bytes: 3,
    },
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
} as ModelManifest;

const model: StoredModel = {
  ref: "owner/model@" + "a".repeat(40),
  manifest,
  active: false,
  conformance: "pending",
  diskBytes: 5,
  installedAt: 1,
};

const createStubWorker = (overrides: Partial<Record<string, unknown>> = {}): InferenceWorker => {
  return {
    request: vi.fn((type: string) => {
      if (type === "model.load") {
        return Promise.resolve(
          (overrides["model.load"] as unknown) ??
            buildRpcMessage("model.loaded", {
              device: "wasm",
              dimensions: 384,
              loadDurationMs: 120,
            }),
        );
      }

      return Promise.resolve(
        (overrides["worker.embed"] as unknown) ??
          buildRpcMessage("worker.embedded", {
            vectors: [new Float32Array(384)],
            device: "wasm",
            durationMs: 5,
          }),
      );
    }),
    terminate: vi.fn(),
  } as unknown as InferenceWorker;
};

let database: IDBPDatabase<ModelDatabaseSchema>;

const storeFiles = async (paths: readonly string[]) => {
  await Promise.all(
    paths.map((path) =>
      database.put(MODEL_FILE_STORE, { ref: model.ref, path, contents: encode(path) }),
    ),
  );
};

beforeEach(async () => {
  database = await openModelDatabase();
  await database.clear(MODEL_FILE_STORE);
});

describe("loadModelIntoWorker", () => {
  it("sends the manifest and every file the manifest lists", async () => {
    await storeFiles(["config.json", "onnx/model_quantized.onnx"]);
    const worker = createStubWorker();

    await loadModelIntoWorker({ model, database, worker, device: "wasm" });

    const [[, payload]] = vi.mocked(worker.request).mock.calls as unknown as [
      [string, { manifest: ModelManifest; files: { path: string }[] }],
    ];

    expect(payload.manifest).toEqual(manifest);
    expect(payload.files.map((file) => file.path)).toEqual([
      "config.json",
      "onnx/model_quantized.onnx",
    ]);
  });

  it("asks for the device it was told to use", async () => {
    await storeFiles(["config.json", "onnx/model_quantized.onnx"]);
    const worker = createStubWorker();

    await loadModelIntoWorker({ model, database, worker, device: "webgpu" });

    expect(worker.request).toHaveBeenCalledWith(
      "model.load",
      expect.objectContaining({ device: "webgpu" }),
    );
  });

  it("reports the device the worker actually loaded on, not the one requested", async () => {
    await storeFiles(["config.json", "onnx/model_quantized.onnx"]);
    const worker = createStubWorker({
      "model.load": buildRpcMessage("model.loaded", {
        device: "wasm",
        dimensions: 384,
        loadDurationMs: 9,
      }),
    });

    const session = await loadModelIntoWorker({ model, database, worker, device: "webgpu" });

    expect(session.device).toBe("wasm");
  });

  it("reports how long loading took", async () => {
    await storeFiles(["config.json", "onnx/model_quantized.onnx"]);

    const session = await loadModelIntoWorker({
      model,
      database,
      worker: createStubWorker(),
      device: "wasm",
    });

    expect(session.loadDurationMs).toBe(120);
  });

  it("returns an embed function that goes through the worker", async () => {
    await storeFiles(["config.json", "onnx/model_quantized.onnx"]);
    const worker = createStubWorker();
    const session = await loadModelIntoWorker({ model, database, worker, device: "wasm" });

    const vectors = await session.embed(["a question"], "query");

    expect(vectors).toHaveLength(1);
    expect(worker.request).toHaveBeenCalledWith("worker.embed", {
      texts: ["a question"],
      role: "query",
    });
  });

  it("names the file that is missing from storage", async () => {
    await storeFiles(["config.json"]);

    await expect(
      loadModelIntoWorker({ model, database, worker: createStubWorker(), device: "wasm" }),
    ).rejects.toThrow(/model_quantized\.onnx" is missing from storage/);
  });

  it("suggests reinstalling, which is what actually fixes a missing file", async () => {
    await storeFiles([]);

    await expect(
      loadModelIntoWorker({ model, database, worker: createStubWorker(), device: "wasm" }),
    ).rejects.toThrow(/Reinstalling/);
  });

  it("does not send a load request when a file is missing", async () => {
    await storeFiles(["config.json"]);
    const worker = createStubWorker();

    await expect(
      loadModelIntoWorker({ model, database, worker, device: "wasm" }),
    ).rejects.toThrow();

    expect(worker.request).not.toHaveBeenCalled();
  });

  it("reports a worker that answers a load with something else", async () => {
    await storeFiles(["config.json", "onnx/model_quantized.onnx"]);
    const worker = createStubWorker({
      "model.load": buildRpcMessage("worker.pong", {
        availableDevices: ["wasm"],
        crossOriginIsolated: false,
        threadCount: 1,
      }),
    });

    await expect(loadModelIntoWorker({ model, database, worker, device: "wasm" })).rejects.toThrow(
      /answered a load with "worker\.pong"/,
    );
  });

  it("reports a worker that answers an embedding request with something else", async () => {
    await storeFiles(["config.json", "onnx/model_quantized.onnx"]);
    const worker = createStubWorker({
      "worker.embed": buildRpcMessage("worker.error", {
        requestType: "worker.embed",
        reason: "no model",
      }),
    });
    const session = await loadModelIntoWorker({ model, database, worker, device: "wasm" });

    await expect(session.embed(["a"], "document")).rejects.toThrow(/answered an embedding request/);
  });

  it("ignores files in storage the manifest does not list", async () => {
    await storeFiles(["config.json", "onnx/model_quantized.onnx", "leftover.bin"]);
    const worker = createStubWorker();

    await loadModelIntoWorker({ model, database, worker, device: "wasm" });

    const [[, payload]] = vi.mocked(worker.request).mock.calls as unknown as [
      [string, { files: { path: string }[] }],
    ];

    expect(payload.files.map((file) => file.path)).not.toContain("leftover.bin");
  });
});
