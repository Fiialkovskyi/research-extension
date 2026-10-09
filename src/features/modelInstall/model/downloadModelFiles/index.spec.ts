import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { downloadModelFiles, type InstallProgress } from ".";
import type { ModelManifest } from "@/shared/modelManifest";
import { MODEL_FILE_STORE, type ModelDatabaseSchema, openModelDatabase } from "@/shared/storage";
import { getFileDigest } from "../assertFileDigest/utils/getFileDigest";

const revision = "751bff37182d3f1213fa05d7196b954e230abad9";
const ref = `Xenova/all-MiniLM-L6-v2@${revision}`;

const contentsByPath: Record<string, string> = {
  "config.json": '{"hidden_size":384}',
  "onnx/model_quantized.onnx": "the weights",
};

const encode = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

const buildManifest = async (): Promise<ModelManifest> => {
  const files = await Promise.all(
    Object.entries(contentsByPath).map(async ([path, text]) => ({
      path,
      digest: {
        algorithm: "sha256" as const,
        value: await getFileDigest(encode(text), "sha256"),
      },
      bytes: new TextEncoder().encode(text).byteLength,
    })),
  );

  return {
    manifestVersion: 1,
    reference: { hub: "huggingface", repository: "Xenova/all-MiniLM-L6-v2", revision },
    format: "onnx",
    files,
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
};

/** Answers with the real contents of whichever path the url names. */
const stubFetch = (overrides: { body?: string; ok?: boolean; status?: number } = {}) => {
  return vi.fn((url: string) => {
    const path = Object.keys(contentsByPath).find((candidate) => url.endsWith(`/${candidate}`));
    const text = overrides.body ?? (path === undefined ? "" : contentsByPath[path]);

    return Promise.resolve({
      ok: overrides.ok ?? true,
      status: overrides.status ?? 200,
      arrayBuffer: () => Promise.resolve(encode(text ?? "")),
    });
  }) as unknown as typeof fetch;
};

let database: IDBPDatabase<ModelDatabaseSchema>;
let manifest: ModelManifest;

beforeEach(async () => {
  database = await openModelDatabase();
  await database.clear(MODEL_FILE_STORE);
  manifest = await buildManifest();
});

describe("downloadModelFiles", () => {
  it("stores every file of the manifest", async () => {
    await downloadModelFiles({ manifest, database, fetchResource: stubFetch() });

    const stored = await database.getAllFromIndex(MODEL_FILE_STORE, "ref", ref);

    expect(stored.map((file) => file.path).toSorted()).toEqual(
      Object.keys(contentsByPath).toSorted(),
    );
  });

  it("reports the installed size", async () => {
    const { diskBytes } = await downloadModelFiles({
      manifest,
      database,
      fetchResource: stubFetch(),
    });

    expect(diskBytes).toBe(manifest.files.reduce((total, file) => total + file.bytes, 0));
  });

  it("sends no credentials with any request", async () => {
    const fetchResource = stubFetch();

    await downloadModelFiles({ manifest, database, fetchResource });

    for (const call of vi.mocked(fetchResource).mock.calls) {
      expect(call[1]).toMatchObject({ credentials: "omit" });
    }
  });

  it("addresses every file at the pinned commit", async () => {
    const fetchResource = stubFetch();

    await downloadModelFiles({ manifest, database, fetchResource });

    for (const call of vi.mocked(fetchResource).mock.calls) {
      expect(String(call[0])).toContain(`/resolve/${revision}/`);
    }
  });

  it("reports progress for each file and a final completion", async () => {
    const progress: InstallProgress[] = [];

    await downloadModelFiles({
      manifest,
      database,
      fetchResource: stubFetch(),
      onProgress: (update) => progress.push(update),
    });

    expect(progress).toHaveLength(manifest.files.length + 1);
    expect(progress.at(0)).toMatchObject({ completedFiles: 0, completedBytes: 0 });
    expect(progress.at(-1)).toMatchObject({
      completedFiles: manifest.files.length,
      completedBytes: manifest.files.reduce((total, file) => total + file.bytes, 0),
    });
  });

  it("reports a total that does not change as the install proceeds", async () => {
    const totals = new Set<number>();

    await downloadModelFiles({
      manifest,
      database,
      fetchResource: stubFetch(),
      onProgress: (update) => totals.add(update.totalBytes),
    });

    expect(totals.size).toBe(1);
  });

  it("does nothing when every file is already stored", async () => {
    const fetchResource = stubFetch();

    await downloadModelFiles({ manifest, database, fetchResource });
    const callsAfterFirst = vi.mocked(fetchResource).mock.calls.length;

    await downloadModelFiles({ manifest, database, fetchResource });

    expect(vi.mocked(fetchResource).mock.calls.length).toBe(callsAfterFirst);
  });

  it("leaves nothing behind when a file does not match its manifest", async () => {
    const fetchResource = stubFetch({ body: "tampered" });

    await expect(downloadModelFiles({ manifest, database, fetchResource })).rejects.toThrow(
      /does not match its manifest/,
    );

    expect(await database.getAllFromIndex(MODEL_FILE_STORE, "ref", ref)).toEqual([]);
  });

  it("removes the files it already wrote when a later file fails", async () => {
    // The first file verifies, the second does not.
    let call = 0;
    const fetchResource = vi.fn(() => {
      call += 1;
      const text = call === 1 ? contentsByPath["config.json"] : "tampered";

      return Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(encode(text ?? "")),
      });
    }) as unknown as typeof fetch;

    await expect(downloadModelFiles({ manifest, database, fetchResource })).rejects.toThrow();

    expect(await database.getAllFromIndex(MODEL_FILE_STORE, "ref", ref)).toEqual([]);
  });

  it("reports the status when the hub refuses a request", async () => {
    await expect(
      downloadModelFiles({
        manifest,
        database,
        fetchResource: stubFetch({ ok: false, status: 403 }),
      }),
    ).rejects.toThrow(/403/);
  });

  it("stores nothing when the very first request fails", async () => {
    await expect(
      downloadModelFiles({
        manifest,
        database,
        fetchResource: stubFetch({ ok: false, status: 500 }),
      }),
    ).rejects.toThrow();

    expect(await database.count(MODEL_FILE_STORE)).toBe(0);
  });

  it("does not disturb another model's files when an install fails", async () => {
    await database.put(MODEL_FILE_STORE, {
      ref: "other/model@" + "b".repeat(40),
      path: "config.json",
      contents: encode("{}"),
    });

    await expect(
      downloadModelFiles({ manifest, database, fetchResource: stubFetch({ body: "tampered" }) }),
    ).rejects.toThrow();

    expect(await database.count(MODEL_FILE_STORE)).toBe(1);
  });
});
