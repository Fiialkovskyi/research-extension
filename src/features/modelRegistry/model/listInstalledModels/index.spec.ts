import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { listInstalledModels } from ".";
import type { ModelManifest } from "@/shared/modelManifest";
import {
  MODEL_STORE,
  type ResearchDatabaseSchema,
  openResearchDatabase,
  type StoredModel,
} from "@/shared/storage";

const manifest = (repository: string, revision: string): ModelManifest =>
  ({
    manifestVersion: 1,
    reference: { hub: "huggingface", repository, revision },
    format: "onnx",
    quantization: "q8",
    files: [{ path: "a", digest: { algorithm: "sha256", value: "a".repeat(64) }, bytes: 1 }],
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
  }) as ModelManifest;

const model = (overrides: Partial<StoredModel> & { ref: string }): StoredModel => ({
  manifest: manifest("Xenova/all-MiniLM-L6-v2", "a".repeat(40)),
  active: false,
  conformance: "pending",
  diskBytes: 23_000_000,
  installedAt: 1_000,
  ...overrides,
});

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(MODEL_STORE);
});

describe("listInstalledModels", () => {
  it("returns nothing when nothing is installed", async () => {
    expect(await listInstalledModels(database)).toEqual([]);
  });

  it("flattens the pinned revision and family out of the manifest", async () => {
    await database.put(MODEL_STORE, model({ ref: "a" }));

    expect((await listInstalledModels(database))[0]).toMatchObject({
      repository: "Xenova/all-MiniLM-L6-v2",
      revision: "a".repeat(40),
      family: "embedding",
      quantization: "q8",
    });
  });

  it("reports disk use, so a surface can show what a model costs", async () => {
    await database.put(MODEL_STORE, model({ ref: "a", diskBytes: 34_014_426 }));

    expect((await listInstalledModels(database))[0]?.diskBytes).toBe(34_014_426);
  });

  it("reports conformance and the reason it failed", async () => {
    await database.put(
      MODEL_STORE,
      model({ ref: "a", conformance: "failed", conformanceReason: "ordering probe" }),
    );

    expect((await listInstalledModels(database))[0]).toMatchObject({
      conformance: "failed",
      conformanceReason: "ordering probe",
    });
  });

  it("reports whether a model is active", async () => {
    await database.put(MODEL_STORE, model({ ref: "a", active: true }));

    expect((await listInstalledModels(database))[0]?.active).toBe(true);
  });

  it("lists the most recently installed first", async () => {
    await database.put(MODEL_STORE, model({ ref: "older", installedAt: 1_000 }));
    await database.put(MODEL_STORE, model({ ref: "newer", installedAt: 2_000 }));

    expect((await listInstalledModels(database)).map((entry) => entry.ref)).toEqual([
      "newer",
      "older",
    ]);
  });

  it("lists models of every family, not only the active one", async () => {
    await database.put(MODEL_STORE, model({ ref: "a" }));
    await database.put(
      MODEL_STORE,
      model({ ref: "b", manifest: manifest("owner/other", "b".repeat(40)) }),
    );

    expect(await listInstalledModels(database)).toHaveLength(2);
  });
});
