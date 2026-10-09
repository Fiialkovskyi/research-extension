import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { getActiveModel } from ".";
import { MINILM_L6_V2 } from "@/shared/config/modelProfiles";
import type { ModelManifest } from "@/shared/modelManifest";
import {
  MODEL_STORE,
  type ModelDatabaseSchema,
  openModelDatabase,
  type StoredModel,
} from "@/shared/storage";

const manifest = (family: "embedding" | "text-generation"): ModelManifest =>
  ({
    manifestVersion: 1,
    reference: {
      hub: "huggingface",
      repository: MINILM_L6_V2.repository,
      revision: MINILM_L6_V2.revision,
    },
    format: "onnx",
    files: [{ path: "a", digest: { algorithm: "sha256", value: "a".repeat(64) }, bytes: 1 }],
    license: "Apache-2.0",
    contract:
      family === "embedding"
        ? {
            family: "embedding",
            dimensions: 384,
            maxInputTokens: 512,
            pooling: "mean",
            normalize: true,
            similarity: "cosine",
            prefixes: { query: "", document: "" },
          }
        : {
            family: "text-generation",
            contextWindow: 4096,
            maxNewTokens: 512,
            chatTemplate: "from_tokenizer_config",
            structuredOutput: "none",
          },
  }) as ModelManifest;

const model = (overrides: Partial<StoredModel> & { ref: string }): StoredModel => ({
  manifest: manifest("embedding"),
  active: true,
  conformance: "passed",
  diskBytes: 1,
  installedAt: 1_000,
  ...overrides,
});

let database: IDBPDatabase<ModelDatabaseSchema>;

beforeEach(async () => {
  database = await openModelDatabase();
  await database.clear(MODEL_STORE);
});

describe("getActiveModel", () => {
  it("returns nothing when nothing is installed", async () => {
    expect(await getActiveModel(database, "embedding")).toBeUndefined();
  });

  it("returns the activated model of the asked-for family", async () => {
    await database.put(MODEL_STORE, model({ ref: "a" }));

    expect((await getActiveModel(database, "embedding"))?.ref).toBe("a");
  });

  it("withholds a model the user has not activated", async () => {
    await database.put(MODEL_STORE, model({ ref: "a", active: false }));

    expect(await getActiveModel(database, "embedding")).toBeUndefined();
  });

  it.each(["pending", "failed"] as const)(
    "withholds a model whose conformance is %s, even when marked active",
    async (conformance) => {
      await database.put(MODEL_STORE, model({ ref: "a", conformance }));

      expect(await getActiveModel(database, "embedding")).toBeUndefined();
    },
  );

  it("does not return a model of another family", async () => {
    await database.put(
      MODEL_STORE,
      model({ ref: "generator", manifest: manifest("text-generation") }),
    );

    expect(await getActiveModel(database, "embedding")).toBeUndefined();
    expect((await getActiveModel(database, "text-generation"))?.ref).toBe("generator");
  });

  it("prefers the most recently installed when two are somehow active", async () => {
    await database.put(MODEL_STORE, model({ ref: "older", installedAt: 1_000 }));
    await database.put(MODEL_STORE, model({ ref: "newer", installedAt: 2_000 }));

    expect((await getActiveModel(database, "embedding"))?.ref).toBe("newer");
  });

  it("ignores an inactive model while returning the active one", async () => {
    await database.put(MODEL_STORE, model({ ref: "inactive", active: false, installedAt: 3_000 }));
    await database.put(MODEL_STORE, model({ ref: "active", installedAt: 1_000 }));

    expect((await getActiveModel(database, "embedding"))?.ref).toBe("active");
  });
});
