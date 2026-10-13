import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { enqueueClusterSummaries } from ".";
import {
  CLUSTERING_STORE,
  FACT_STORE,
  JOB_STORE,
  MODEL_STORE,
  openResearchDatabase,
  SESSION_STORE,
  SUMMARY_STORE,
} from "@/shared/storage";

import { getFactSetHash } from "../getFactSetHash";

const NOW = Date.now() + 1_000;

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all(
    (
      [CLUSTERING_STORE, FACT_STORE, JOB_STORE, MODEL_STORE, SESSION_STORE, SUMMARY_STORE] as const
    ).map((store) => database.clear(store)),
  );
  await database.put(SESSION_STORE, {
    id: "s",
    title: "Laptops",
    groupId: 1,
    formerGroupIds: [],
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  });
  await database.put(MODEL_STORE, {
    ref: "ollama:qwen3:4b@abc",
    manifest: { contract: { family: "text-generation" } },
    active: true,
    conformance: "passed",
    installedAt: 1,
  } as never);
  await database.put(CLUSTERING_STORE, {
    sessionId: "s",
    algorithmVersion: "louvain@1",
    configVersion: "c",
    computedAt: 1,
    clusters: [
      { id: "laptops", label: "Laptops", memberIds: ["a", "b"] },
      { id: "empty", label: "Nothing read", memberIds: ["c"] },
    ],
  });
  await database.put(FACT_STORE, { id: "a:0:0", nodeId: "a", sessionId: "s" } as never);
  await database.put(FACT_STORE, { id: "b:0:0", nodeId: "b", sessionId: "s" } as never);
});

describe("enqueueClusterSummaries", () => {
  it("queues a summary a minute ahead for each cluster with facts, below extraction", async () => {
    const jobs = await enqueueClusterSummaries(await openResearchDatabase(), NOW);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      type: "summarizeCluster",
      nextAttemptAt: NOW + 60_000,
      payload: { clusterId: "laptops", factSetHash: await getFactSetHash(["a:0:0", "b:0:0"]) },
      producerVersion: "clusterSummary@1|ollama:qwen3:4b@abc",
    });
    expect(jobs[0]!.priority).toBeLessThan(-10);
  });

  it("queues nothing when the summary is current", async () => {
    const database = await openResearchDatabase();

    await database.put(SUMMARY_STORE, {
      id: "s:laptops",
      factSetHash: await getFactSetHash(["a:0:0", "b:0:0"]),
      modelRef: "ollama:qwen3:4b@abc",
    } as never);

    expect(await enqueueClusterSummaries(database, NOW)).toEqual([]);
  });

  it("queues another job once the fact set changes", async () => {
    const database = await openResearchDatabase();

    await enqueueClusterSummaries(database, NOW);
    await database.put(FACT_STORE, { id: "b:0:1", nodeId: "b", sessionId: "s" } as never);
    await enqueueClusterSummaries(database, NOW + 10_000);

    expect(await database.count(JOB_STORE)).toBe(2);
  });

  it("queues nothing without a generation model", async () => {
    const database = await openResearchDatabase();

    await database.clear(MODEL_STORE);

    expect(await enqueueClusterSummaries(database, NOW)).toEqual([]);
  });
});
