import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { activateModel } from ".";
import type { ConformanceOutcome } from "@/features/modelConformance";
import type { ModelManifest } from "@/shared/modelManifest";
import {
  MODEL_STORE,
  type ResearchDatabaseSchema,
  openResearchDatabase,
  type StoredModel,
} from "@/shared/storage";
import { getActiveModel } from "../getActiveModel";

const manifest = (family: "embedding" | "text-generation" = "embedding"): ModelManifest =>
  ({
    manifestVersion: 1,
    reference: { hub: "huggingface", repository: "owner/model", revision: "a".repeat(40) },
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
  manifest: manifest(),
  active: false,
  conformance: "pending",
  diskBytes: 1,
  installedAt: 1_000,
  ...overrides,
});

const passed: ConformanceOutcome = { passed: true, probes: [] };
const failed: ConformanceOutcome = {
  passed: false,
  probes: [
    { name: "places a paraphrase closer than a stranger", passed: false, detail: "4 of 20" },
  ],
  reason: "4 of 20 pairs ordered correctly, 18 required",
};

let database: IDBPDatabase<ResearchDatabaseSchema>;

beforeEach(async () => {
  database = await openResearchDatabase();
  await database.clear(MODEL_STORE);
});

describe("activateModel", () => {
  it("activates a model that passes its suite", async () => {
    await database.put(MODEL_STORE, model({ ref: "a" }));

    const recorded = await activateModel({
      ref: "a",
      database,
      runConformance: () => Promise.resolve(passed),
    });

    expect(recorded).toMatchObject({ active: true, conformance: "passed" });
  });

  it("makes a passing model reachable through the active-model lookup", async () => {
    await database.put(MODEL_STORE, model({ ref: "a" }));

    await activateModel({ ref: "a", database, runConformance: () => Promise.resolve(passed) });

    expect((await getActiveModel(database, "embedding"))?.ref).toBe("a");
  });

  it("refuses a model that fails, and records why", async () => {
    await database.put(MODEL_STORE, model({ ref: "a" }));

    const recorded = await activateModel({
      ref: "a",
      database,
      runConformance: () => Promise.resolve(failed),
    });

    expect(recorded).toMatchObject({ active: false, conformance: "failed" });
    expect(recorded.conformanceReason).toContain("18 required");
  });

  it("keeps a failed model out of the active-model lookup", async () => {
    await database.put(MODEL_STORE, model({ ref: "a" }));

    await activateModel({ ref: "a", database, runConformance: () => Promise.resolve(failed) });

    expect(await getActiveModel(database, "embedding")).toBeUndefined();
  });

  it("persists the reason, so the surface can explain the refusal later", async () => {
    await database.put(MODEL_STORE, model({ ref: "a" }));

    await activateModel({ ref: "a", database, runConformance: () => Promise.resolve(failed) });

    expect((await database.get(MODEL_STORE, "a"))?.conformanceReason).toBe(failed.reason);
  });

  it("runs the suite on every activation, not once per install", async () => {
    // The outcome depends on the runtime and device, so passing elsewhere is
    // not evidence about this machine.
    await database.put(MODEL_STORE, model({ ref: "a", conformance: "passed", active: true }));
    const runConformance = vi.fn().mockResolvedValue(passed);

    await activateModel({ ref: "a", database, runConformance });

    expect(runConformance).toHaveBeenCalledOnce();
  });

  it("deactivates the previous model of the same family", async () => {
    await database.put(MODEL_STORE, model({ ref: "old", active: true, conformance: "passed" }));
    await database.put(MODEL_STORE, model({ ref: "new" }));

    await activateModel({ ref: "new", database, runConformance: () => Promise.resolve(passed) });

    expect((await database.get(MODEL_STORE, "old"))?.active).toBe(false);
    expect((await getActiveModel(database, "embedding"))?.ref).toBe("new");
  });

  it("leaves another family's active model alone", async () => {
    await database.put(
      MODEL_STORE,
      model({
        ref: "generator",
        active: true,
        conformance: "passed",
        manifest: manifest("text-generation"),
      }),
    );
    await database.put(MODEL_STORE, model({ ref: "encoder" }));

    await activateModel({
      ref: "encoder",
      database,
      runConformance: () => Promise.resolve(passed),
    });

    expect((await database.get(MODEL_STORE, "generator"))?.active).toBe(true);
  });

  it("does not deactivate anything when activation is refused", async () => {
    await database.put(MODEL_STORE, model({ ref: "old", active: true, conformance: "passed" }));
    await database.put(MODEL_STORE, model({ ref: "new" }));

    await activateModel({ ref: "new", database, runConformance: () => Promise.resolve(failed) });

    expect((await getActiveModel(database, "embedding"))?.ref).toBe("old");
  });

  it("clears a stale reason when a model later passes", async () => {
    await database.put(
      MODEL_STORE,
      model({ ref: "a", conformance: "failed", conformanceReason: "an older failure" }),
    );

    const recorded = await activateModel({
      ref: "a",
      database,
      runConformance: () => Promise.resolve(passed),
    });

    expect(recorded.conformanceReason).toBeUndefined();
  });

  it("reports a model that is not installed", async () => {
    await expect(
      activateModel({ ref: "absent", database, runConformance: () => Promise.resolve(passed) }),
    ).rejects.toThrow(/No model is installed/);
  });
});
