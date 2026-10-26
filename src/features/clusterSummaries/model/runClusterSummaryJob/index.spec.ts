import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { runClusterSummaryJob } from ".";
import { decryptBytes, encryptBytes, getDataKey } from "@/features/dataProtection";
import type { GenerateRequest, GenerationStream } from "@/features/inference";
import {
  CLUSTERING_STORE,
  FACT_STORE,
  INFERENCE_RUN_STORE,
  openResearchDatabase,
  type StoredJob,
  SUMMARY_STORE,
} from "@/shared/storage";

import { getFactSetHash } from "../getFactSetHash";

const storeFact = async (id: string, nodeId: string, subject: string) => {
  const database = await openResearchDatabase();
  const dataKey = await getDataKey(database);
  const text = {
    subject,
    entityType: "product",
    attribute: "weight",
    value: "1",
    quote: `${subject} quote`,
  };
  const sealed = await encryptBytes(dataKey, new TextEncoder().encode(JSON.stringify(text)));

  await database.put(FACT_STORE, {
    id,
    sessionId: "s",
    nodeId,
    snapshotId: id.split(":")[0]!,
    chunkId: "c",
    provenance: { modelRef: "m", prompt: "p", chunkerVersion: "c", extractedAt: 1 },
    keyId: sealed.keyId,
    iv: sealed.iv,
    encryptedFact: sealed.ciphertext,
  });
};

const answerWith = (text: string): GenerationStream => ({
  final: () => Promise.resolve({ text, device: "local-server", stoppedBecause: "model" }),
  async *[Symbol.asyncIterator]() {
    yield { delta: text };
  },
});

/** Cites F1 and F2, and invents F99. */
const summarize = vi.fn((_request: GenerateRequest) =>
  answerWith(
    JSON.stringify({
      statements: [
        { text: "Volta is lighter than Corsa.", facts: ["F1", "F2"] },
        { text: "Invented.", facts: ["F99"] },
      ],
    }),
  ),
);

let job: StoredJob;

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all(
    ([CLUSTERING_STORE, FACT_STORE, SUMMARY_STORE, INFERENCE_RUN_STORE] as const).map((store) =>
      database.clear(store),
    ),
  );
  await database.put(CLUSTERING_STORE, {
    sessionId: "s",
    algorithmVersion: "a",
    configVersion: "c",
    computedAt: 1,
    clusters: [{ id: "bikes", label: "E-bikes", memberIds: ["a", "b"] }],
  });
  await storeFact("a:0:0", "a", "Volta");
  await storeFact("b:0:0", "b", "Corsa");
  summarize.mockClear();
  job = {
    id: "j",
    type: "summarizeCluster",
    sessionId: "s",
    inputHashes: [],
    producerVersion: "p",
    status: "running",
    priority: -20,
    attempts: 0,
    nextAttemptAt: 0,
    createdAt: 0,
    updatedAt: 0,
    payload: { clusterId: "bikes", factSetHash: await getFactSetHash(["a:0:0", "b:0:0"]) },
  };
});

const run = async (generate = summarize) =>
  runClusterSummaryJob({
    database: await openResearchDatabase(),
    job,
    modelRef: "ollama:qwen3:4b@abc",
    generate,
    now: () => 5_000,
  });

describe("runClusterSummaryJob", () => {
  it("stores the cited statements encrypted, dropping one that cites nothing given", async () => {
    expect(await run()).toBe(true);

    const database = await openResearchDatabase();
    const summary = await database.get(SUMMARY_STORE, "s:bikes");

    expect(summary).toMatchObject({
      clusterId: "bikes",
      citedFactIds: expect.arrayContaining(["a:0:0", "b:0:0"]),
      inputFactCount: 2,
      omittedFactCount: 0,
      modelRef: "ollama:qwen3:4b@abc",
      prompt: "clusterSummary@2",
      generatedAt: 5_000,
    });
    expect(JSON.stringify(summary)).not.toContain("lighter");

    const plain = await decryptBytes(await getDataKey(database), {
      keyId: summary!.keyId,
      cipher: "aes-gcm-256",
      iv: summary!.iv,
      ciphertext: summary!.encryptedStatements,
    });

    expect(JSON.parse(new TextDecoder().decode(plain))).toEqual([
      { text: "Volta is lighter than Corsa.", factIds: expect.arrayContaining(["a:0:0", "b:0:0"]) },
    ]);
  });

  it("asks once, with the facts as data, bounded, in the schema, with a larger context", async () => {
    await run();

    expect(summarize).toHaveBeenCalledTimes(1);
    expect(summarize.mock.calls[0]?.[0]).toMatchObject({
      maxTokens: 1_024,
      contextTokens: 8_192,
      temperature: 0,
    });
    expect(summarize.mock.calls[0]?.[0].messages[1]?.content).toMatch(/^<facts>\nF1 \| /u);
  });

  it("does nothing when the cluster's facts changed while it waited", async () => {
    await storeFact("b:0:1", "b", "Corsa");

    expect(await run()).toBe(false);
    expect(summarize).not.toHaveBeenCalled();
  });

  it("fails on an answer outside the schema, logging the run", async () => {
    await expect(run(vi.fn(() => answerWith("Here is a summary.")))).rejects.toThrow("not JSON");
    expect((await (await openResearchDatabase()).getAll(INFERENCE_RUN_STORE))[0]?.outcome).toBe(
      "failed",
    );
  });
});
