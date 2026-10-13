import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { requestClusterSummary } from ".";
import {
  CLUSTERING_STORE,
  FACT_STORE,
  JOB_STORE,
  MODEL_STORE,
  openResearchDatabase,
  SESSION_STORE,
} from "@/shared/storage";

import { enqueueClusterSummaries } from "../enqueueClusterSummaries";

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all(
    ([CLUSTERING_STORE, FACT_STORE, JOB_STORE, MODEL_STORE, SESSION_STORE] as const).map((store) =>
      database.clear(store),
    ),
  );
  await database.put(SESSION_STORE, {
    id: "s",
    title: "E-bikes",
    groupId: 1,
    formerGroupIds: [],
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  });
  await database.put(MODEL_STORE, {
    ref: "m",
    manifest: { contract: { family: "text-generation" } },
    active: true,
    conformance: "passed",
    installedAt: 1,
  } as never);
  await database.put(CLUSTERING_STORE, {
    sessionId: "s",
    algorithmVersion: "a",
    configVersion: "c",
    computedAt: 1,
    clusters: [{ id: "bikes", label: "E-bikes", memberIds: ["a"] }],
  });
  await database.put(FACT_STORE, { id: "a:0:0", nodeId: "a", sessionId: "s" } as never);
});

describe("requestClusterSummary", () => {
  it("marks the debounced job as asked for and due now", async () => {
    const database = await openResearchDatabase();
    const [debounced] = await enqueueClusterSummaries(database, Date.now());

    expect(await requestClusterSummary(database, "bikes", 123)).toBe(true);
    expect(await database.get(JOB_STORE, debounced!.id)).toMatchObject({
      nextAttemptAt: 123,
      payload: { clusterId: "bikes", requestedAt: 123 },
    });
    expect(await database.count(JOB_STORE)).toBe(1);
  });

  it("queues a done job again, to regenerate on request", async () => {
    const database = await openResearchDatabase();
    const [job] = await enqueueClusterSummaries(database, Date.now());

    await database.put(JOB_STORE, { ...job!, status: "done" });
    await requestClusterSummary(database, "bikes", 5);

    expect((await database.get(JOB_STORE, job!.id))?.status).toBe("queued");
  });

  it("queues nothing for a cluster without facts, or that does not exist", async () => {
    const database = await openResearchDatabase();

    await database.clear(FACT_STORE);

    expect(await requestClusterSummary(database, "bikes")).toBe(false);
    expect(await requestClusterSummary(database, "missing")).toBe(false);
  });
});
