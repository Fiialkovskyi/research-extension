import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { installModel } from ".";
import { MINILM_L6_V2, type ModelProfile } from "@/shared/config/modelProfiles";
import {
  MODEL_FILE_STORE,
  MODEL_STORE,
  type ModelDatabaseSchema,
  openModelDatabase,
} from "@/shared/storage";
import { getFileDigest } from "../assertFileDigest/utils/getFileDigest";

/** A profile with two files, so a partial failure is observable. */
const profile: ModelProfile = {
  ...MINILM_L6_V2,
  files: ["config.json", "onnx/model_quantized.onnx"],
};

const fileContents: Record<string, string> = {
  "config.json": '{"model_type":"bert","hidden_size":384,"max_position_embeddings":512}',
  "tokenizer_config.json": '{"model_max_length":512}',
  "onnx/model_quantized.onnx": "the weights",
};

const encode = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;
const byteLength = (text: string) => new TextEncoder().encode(text).byteLength;

const buildTree = async () => {
  return Promise.all(
    Object.entries(fileContents).map(async ([path, text]) => ({
      type: "file",
      path,
      size: byteLength(text),
      lfs: { oid: await getFileDigest(encode(text), "sha256") },
    })),
  );
};

/** Routes by URL shape: the listing endpoint, or a file at a pinned commit. */
const stubFetch = (tree: unknown, overrides: { treeOk?: boolean; weightsBody?: string } = {}) => {
  return vi.fn((rawUrl: string) => {
    const url = String(rawUrl);

    if (url.includes("/tree/")) {
      return Promise.resolve({
        ok: overrides.treeOk ?? true,
        status: overrides.treeOk === false ? 500 : 200,
        json: () => Promise.resolve(tree),
      });
    }

    const path = Object.keys(fileContents).find((candidate) => url.endsWith(`/${candidate}`));
    const text =
      path === "onnx/model_quantized.onnx" && overrides.weightsBody !== undefined
        ? overrides.weightsBody
        : (fileContents[path ?? ""] ?? "");

    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(JSON.parse(text)),
      arrayBuffer: () => Promise.resolve(encode(text)),
    });
  }) as unknown as typeof fetch;
};

let database: IDBPDatabase<ModelDatabaseSchema>;
let tree: unknown;

beforeEach(async () => {
  database = await openModelDatabase();
  await database.clear(MODEL_STORE);
  await database.clear(MODEL_FILE_STORE);
  tree = await buildTree();
});

describe("installModel", () => {
  it("records the model under its repository and pinned commit", async () => {
    const model = await installModel({ profile, database, fetchResource: stubFetch(tree) });

    expect(model.ref).toBe(`${profile.repository}@${profile.revision}`);
    expect(await database.get(MODEL_STORE, model.ref)).toMatchObject({ ref: model.ref });
  });

  it("records it inactive and pending, so nothing can use it yet", async () => {
    const model = await installModel({ profile, database, fetchResource: stubFetch(tree) });

    expect(model.active).toBe(false);
    expect(model.conformance).toBe("pending");
  });

  it("derives a contract from the repository's own configuration", async () => {
    const model = await installModel({ profile, database, fetchResource: stubFetch(tree) });

    expect(model.manifest.contract).toMatchObject({
      family: "embedding",
      dimensions: 384,
      maxInputTokens: 512,
    });
  });

  it("stores the files the profile lists", async () => {
    const model = await installModel({ profile, database, fetchResource: stubFetch(tree) });
    const stored = await database.getAllFromIndex(MODEL_FILE_STORE, "ref", model.ref);

    expect(stored.map((file) => file.path).toSorted()).toEqual([...profile.files].toSorted());
  });

  it("records how much disk the model occupies", async () => {
    const model = await installModel({ profile, database, fetchResource: stubFetch(tree) });

    expect(model.diskBytes).toBe(
      byteLength(fileContents["config.json"] ?? "") +
        byteLength(fileContents["onnx/model_quantized.onnx"] ?? ""),
    );
  });

  it("does not re-resolve a profile that is already pinned", async () => {
    const fetchResource = stubFetch(tree);

    await installModel({ profile, database, fetchResource });

    for (const call of vi.mocked(fetchResource).mock.calls) {
      expect(String(call[0])).not.toContain("/revision/");
    }
  });

  it("reports progress while fetching", async () => {
    const onProgress = vi.fn();

    await installModel({ profile, database, fetchResource: stubFetch(tree), onProgress });

    expect(onProgress).toHaveBeenCalled();
  });

  it("records nothing when the listing cannot be read", async () => {
    await expect(
      installModel({ profile, database, fetchResource: stubFetch(tree, { treeOk: false }) }),
    ).rejects.toThrow(/could not list/i);

    expect(await database.count(MODEL_STORE)).toBe(0);
  });

  it("records nothing when a file fails verification", async () => {
    await expect(
      installModel({
        profile,
        database,
        fetchResource: stubFetch(tree, { weightsBody: "tampered" }),
      }),
    ).rejects.toThrow(/does not match its manifest/);

    expect(await database.count(MODEL_STORE)).toBe(0);
    expect(await database.count(MODEL_FILE_STORE)).toBe(0);
  });

  it("records nothing when the listing omits a file the profile needs", async () => {
    const withoutWeights = (tree as { path: string }[]).filter(
      (entry) => entry.path !== "onnx/model_quantized.onnx",
    );

    await expect(
      installModel({ profile, database, fetchResource: stubFetch(withoutWeights) }),
    ).rejects.toThrow(/model_quantized\.onnx/);

    expect(await database.count(MODEL_STORE)).toBe(0);
  });

  it("can be run twice without fetching the files again", async () => {
    const fetchResource = stubFetch(tree);

    await installModel({ profile, database, fetchResource });
    const callsAfterFirst = vi.mocked(fetchResource).mock.calls.length;

    await installModel({ profile, database, fetchResource });

    // The listing and configuration are read again to re-derive the manifest;
    // the files themselves are not re-fetched.
    const weightCalls = vi
      .mocked(fetchResource)
      .mock.calls.slice(callsAfterFirst)
      .filter((call) => String(call[0]).endsWith("model_quantized.onnx"));

    expect(weightCalls).toHaveLength(0);
  });
});
