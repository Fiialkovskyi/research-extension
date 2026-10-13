import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { isLocalAiPaused } from ".";
import { JOB_STORE, MODEL_STORE, openResearchDatabase } from "@/shared/storage";

const model = (hub: "ollama" | "huggingface") => ({
  ref: `${hub}-model`,
  manifest: { reference: { hub }, contract: { family: "embedding" } },
  active: true,
  conformance: "passed",
  installedAt: 1,
});

const job = (status: string, failureReason?: string) => ({
  id: `job-${status}`,
  status,
  priority: 0,
  ...(failureReason === undefined ? {} : { failureReason }),
});

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all([database.clear(MODEL_STORE), database.clear(JOB_STORE)]);
});

describe("isLocalAiPaused", () => {
  it("is paused while a job waits because Ollama is not running", async () => {
    const database = await openResearchDatabase();

    await database.put(MODEL_STORE, model("ollama") as never);
    await database.put(
      JOB_STORE,
      job("queued", "Ollama is not running at http://127.0.0.1:11434.") as never,
    );

    expect(await isLocalAiPaused(database)).toBe(true);
  });

  it("is not paused when jobs fail for other reasons, or none fails", async () => {
    const database = await openResearchDatabase();

    await database.put(MODEL_STORE, model("ollama") as never);
    await database.put(JOB_STORE, job("queued", "Snapshot gone.") as never);

    expect(await isLocalAiPaused(database)).toBe(false);
  });

  it("is never paused for a model the extension runs itself", async () => {
    const database = await openResearchDatabase();

    await database.put(MODEL_STORE, model("huggingface") as never);
    await database.put(JOB_STORE, job("queued", "Ollama is not running at x.") as never);

    expect(await isLocalAiPaused(database)).toBe(false);
  });
});
