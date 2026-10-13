import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { requeuePausedJobs } from ".";
import { JOB_STORE, openResearchDatabase } from "@/shared/storage";

const job = (id: string, status: string, failureReason?: string) => ({
  id,
  type: "embed-snapshot",
  status,
  priority: 0,
  attempts: 4,
  nextAttemptAt: 9_999,
  createdAt: 1,
  updatedAt: 1,
  ...(failureReason === undefined ? {} : { failureReason }),
});

beforeEach(async () => {
  await (await openResearchDatabase()).clear(JOB_STORE);
});

describe("requeuePausedJobs", () => {
  it("hands back jobs stopped by Ollama's absence, due now and with their retries restored", async () => {
    const database = await openResearchDatabase();

    await database.put(
      JOB_STORE,
      job("a", "failed", "Ollama is not running at http://127.0.0.1:11434.") as never,
    );
    await database.put(
      JOB_STORE,
      job("b", "queued", "Ollama at http://127.0.0.1:11434 refused this extension.") as never,
    );

    expect(await requeuePausedJobs(database, 500)).toBe(2);

    const a = await database.get(JOB_STORE, "a");

    expect(a).toMatchObject({ status: "queued", attempts: 0, nextAttemptAt: 500, updatedAt: 500 });
    expect(a?.failureReason).toBeUndefined();
  });

  it("leaves jobs that failed for any other reason, and finished ones", async () => {
    const database = await openResearchDatabase();

    await database.put(JOB_STORE, job("c", "failed", "The snapshot is gone.") as never);
    await database.put(JOB_STORE, job("d", "done") as never);

    expect(await requeuePausedJobs(database, 500)).toBe(0);
    expect(await database.get(JOB_STORE, "c")).toMatchObject({ status: "failed", attempts: 4 });
  });
});
