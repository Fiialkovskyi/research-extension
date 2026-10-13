import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { readSummariesView } from ".";
import { encryptBytes, getDataKey } from "@/features/dataProtection";
import {
  CLUSTERING_STORE,
  FACT_STORE,
  JOB_STORE,
  MODEL_STORE,
  NODE_STORE,
  openResearchDatabase,
  REJECTION_STORE,
  SESSION_STORE,
  SUMMARY_STORE,
} from "@/shared/storage";

import { rejectFacts } from "@/features/factRejections";

import { getFactSetHash } from "../getFactSetHash";

const MODEL = "ollama:qwen3:4b@abc";

const seal = async (value: unknown) =>
  encryptBytes(
    await getDataKey(await openResearchDatabase()),
    new TextEncoder().encode(JSON.stringify(value)),
  );

const storeFact = async (id: string, nodeId: string, quote: string) => {
  const sealed = await seal({ subject: "Volta", attribute: "weight", value: "1", quote });

  await (
    await openResearchDatabase()
  ).put(FACT_STORE, {
    id,
    nodeId,
    sessionId: "s",
    keyId: sealed.keyId,
    iv: sealed.iv,
    encryptedFact: sealed.ciphertext,
  } as never);
};

const storeSummary = async (factSetHash: string, modelRef = MODEL) => {
  const sealed = await seal([{ text: "Volta weighs 23.5 kg.", factIds: ["a:0:0", "gone:0:0"] }]);

  await (
    await openResearchDatabase()
  ).put(SUMMARY_STORE, {
    id: "s:bikes",
    sessionId: "s",
    clusterId: "bikes",
    factSetHash,
    citedFactIds: ["a:0:0"],
    inputFactCount: 1,
    omittedFactCount: 0,
    modelRef,
    prompt: "clusterSummary@1",
    generatedAt: 9,
    keyId: sealed.keyId,
    iv: sealed.iv,
    encryptedStatements: sealed.ciphertext,
  });
};

beforeEach(async () => {
  const database = await openResearchDatabase();

  await Promise.all(
    (
      [
        CLUSTERING_STORE,
        FACT_STORE,
        JOB_STORE,
        MODEL_STORE,
        NODE_STORE,
        SESSION_STORE,
        SUMMARY_STORE,
        REJECTION_STORE,
      ] as const
    ).map((store) => database.clear(store)),
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
  await database.put(NODE_STORE, {
    id: "a",
    sessionId: "s",
    title: "Volta review",
    url: "https://example.org/volta",
  } as never);
  await database.put(MODEL_STORE, {
    ref: MODEL,
    manifest: {
      reference: { repository: "qwen3:4b" },
      contract: { family: "text-generation" },
    },
    active: true,
    conformance: "passed",
    installedAt: 1,
  } as never);
  await database.put(CLUSTERING_STORE, {
    sessionId: "s",
    algorithmVersion: "a",
    configVersion: "c",
    computedAt: 1,
    clusters: [
      { id: "bikes", label: "E-bikes", memberIds: ["a"] },
      { id: "shops", label: "Shops", memberIds: ["x"] },
    ],
  });
  await storeFact("a:0:0", "a", "weighs 23.5 kg");
});

describe("readSummariesView", () => {
  it("shows each cluster, its summary and its citations resolved to page and quote", async () => {
    await storeSummary(await getFactSetHash(["a:0:0"]));

    expect(await readSummariesView(await openResearchDatabase())).toEqual({
      title: "E-bikes",
      canSummarize: true,
      clusters: [
        {
          clusterId: "bikes",
          label: "E-bikes",
          factCount: 1,
          isPending: false,
          summary: {
            statements: [
              {
                text: "Volta weighs 23.5 kg.",
                citations: [
                  {
                    factId: "a:0:0",
                    pageTitle: "Volta review",
                    url: "https://example.org/volta",
                    quote: "weighs 23.5 kg",
                  },
                ],
              },
            ],
            isStale: false,
            omittedFactCount: 0,
            generatedAt: 9,
            modelName: "qwen3:4b",
          },
        },
        { clusterId: "shops", label: "Shops", factCount: 0, isPending: false, summary: null },
      ],
    });
  });

  it("says a summary is stale once its cluster's facts changed", async () => {
    await storeSummary(await getFactSetHash(["a:0:0"]));
    await storeFact("a:0:1", "a", "another");

    expect(
      (await readSummariesView(await openResearchDatabase()))?.clusters[0]?.summary?.isStale,
    ).toBe(true);
  });

  it("says a summary is stale once its model is no longer installed", async () => {
    await storeSummary(await getFactSetHash(["a:0:0"]), "ollama:removed@1");

    expect(
      (await readSummariesView(await openResearchDatabase()))?.clusters[0]?.summary?.isStale,
    ).toBe(true);
  });

  it("drops a rejected fact's citation and shows its summary stale", async () => {
    const database = await openResearchDatabase();

    await storeSummary(await getFactSetHash(["a:0:0"]));
    await rejectFacts(database, ["a:0:0"]);

    const [bikes] = (await readSummariesView(database))?.clusters ?? [];

    expect(bikes?.factCount).toBe(0);
    expect(bikes?.summary).toMatchObject({
      isStale: true,
      statements: [{ text: "Volta weighs 23.5 kg.", citations: [] }],
    });
  });

  it("shows a requested summary as pending", async () => {
    await (
      await openResearchDatabase()
    ).put(JOB_STORE, {
      id: "j",
      type: "summarizeCluster",
      sessionId: "s",
      status: "queued",
      payload: { clusterId: "bikes", factSetHash: "h", requestedAt: 1 },
    } as never);

    expect((await readSummariesView(await openResearchDatabase()))?.clusters[0]?.isPending).toBe(
      true,
    );
  });

  it("shows nothing without a live session", async () => {
    await (await openResearchDatabase()).clear(SESSION_STORE);

    expect(await readSummariesView(await openResearchDatabase())).toBeUndefined();
  });
});
