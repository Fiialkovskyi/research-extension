import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runMetadataEmbeddingJob } from ".";
import { claimNextJob } from "@/features/jobQueue";
import { recordPageMetadata } from "@/features/pageMetadata";
import { recordSnapshot } from "@/features/pageSnapshots";
import { enqueueMetadataEmbeddings } from "../enqueueMetadataEmbeddings";
import {
  CHUNK_STORE,
  JOB_STORE,
  KEY_STORE,
  MODEL_STORE,
  NODE_STORE,
  openResearchDatabase,
  PAGE_METADATA_STORE,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  SNAPSHOT_STORE,
  SPACE_STORE,
  type StoredJob,
  type StoredModel,
  VECTOR_STORE,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

const MODEL = {
  ref: "Xenova/all-MiniLM-L6-v2@aaaa",
  manifest: {
    manifestVersion: 1,
    reference: {
      hub: "huggingface",
      repository: "Xenova/all-MiniLM-L6-v2",
      revision: "a".repeat(40),
    },
    format: "onnx",
    files: [
      { path: "onnx/model.onnx", bytes: 1, digest: { algorithm: "sha256", value: "0".repeat(64) } },
    ],
    license: "apache-2.0",
    contract: {
      family: "embedding",
      dimensions: 4,
      maxInputTokens: 128,
      pooling: "mean",
      normalize: true,
      similarity: "cosine",
      prefixes: { query: "", document: "" },
    },
  },
  active: true,
  conformance: "passed",
  diskBytes: 1,
  installedAt: 1,
} as StoredModel;

const buildSession = () => {
  const calls: string[][] = [];

  return {
    calls,
    loadSession: vi.fn(() =>
      Promise.resolve({
        embed: (texts: readonly string[]) => {
          calls.push([...texts]);
          return Promise.resolve(texts.map(() => new Float32Array([1, 0, 0, 0])));
        },
      }),
    ),
  };
};

const claim = async (): Promise<StoredJob> => {
  await enqueueMetadataEmbeddings(database, "session-1");

  const job = await claimNextJob(database);

  if (job === undefined) {
    throw new Error("No job was queued.");
  }

  return job;
};

const buildNode = (id: string) => ({
  id,
  sessionId: "session-1",
  tabId: 7,
  kind: "page" as const,
  url: `https://example.org/${id}`,
  domain: "example.org",
  title: `Tab ${id}`,
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  signals: {
    activeDwellMs: 0,
    maxScroll: 0,
    copyEvents: 0,
    pasteEvents: 0,
    focusCount: 1,
    revisitCount: 0,
    quickReturnCount: 0,
  },
  tabState: "open" as const,
  createdAt: 1,
});

beforeEach(async () => {
  database = await openResearchDatabase();
  await Promise.all(
    (
      [
        SESSION_STORE,
        NODE_STORE,
        SNAPSHOT_STORE,
        KEY_STORE,
        MODEL_STORE,
        JOB_STORE,
        SPACE_STORE,
        CHUNK_STORE,
        VECTOR_STORE,
        PAGE_METADATA_STORE,
      ] as const
    ).map((store) => database.clear(store)),
  );
  await database.put(SESSION_STORE, {
    id: "session-1",
    title: "E-bike motors",
    groupId: 42,
    formerGroupIds: [],
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  });
  await database.put(NODE_STORE, buildNode("a"));
  await database.put(MODEL_STORE, MODEL);
  await recordPageMetadata(database, {
    nodeId: "a",
    metadata: { title: "Mid-drive motors", description: "How they work." },
    capturedAt: 500,
  });
});

describe("runMetadataEmbeddingJob", () => {
  it("embeds the title and description into one weak vector of the node", async () => {
    const { calls, loadSession } = buildSession();
    const job = await claim();

    expect(await runMetadataEmbeddingJob({ database, job, loadSession })).toBe(1);
    expect(calls).toEqual([["Mid-drive motors\nHow they work."]]);

    const vectors = await database.getAll(VECTOR_STORE);

    expect(vectors).toEqual([
      expect.objectContaining({
        chunkId: "metadata:a",
        part: 0,
        nodeId: "a",
        sessionId: "session-1",
      }),
    ]);
    expect(await database.count(CHUNK_STORE)).toBe(0);
    expect((await database.get(SESSION_STORE, "session-1"))?.activeEmbeddingSpaceId).toBe(
      vectors[0]?.spaceId,
    );
  });

  it("uses the tab's title when the page gave none", async () => {
    await recordPageMetadata(database, {
      nodeId: "a",
      metadata: { description: "How they work." },
      capturedAt: 600,
    });

    const { calls, loadSession } = buildSession();

    await runMetadataEmbeddingJob({ database, job: await claim(), loadSession });

    expect(calls).toEqual([["Tab a\nHow they work."]]);
  });

  it("stores nothing for a node that has a snapshot, whose text is what is embedded", async () => {
    const job = await claim();

    await recordSnapshot(database, {
      nodeId: "a",
      text: "Mid-drive motors sit at the cranks.",
      truncated: false,
      extractorVersion: "readability@0.6.0/1",
      capturedAt: 700,
    });

    const { calls, loadSession } = buildSession();

    expect(await runMetadataEmbeddingJob({ database, job, loadSession })).toBe(0);
    expect(calls).toEqual([]);
    expect(await database.count(VECTOR_STORE)).toBe(0);
  });

  it("fails, to be retried, when the space's model is no longer the active one", async () => {
    const job = await claim();

    await database.put(MODEL_STORE, { ...MODEL, active: false });

    await expect(
      runMetadataEmbeddingJob({ database, job, loadSession: buildSession().loadSession }),
    ).rejects.toThrow("is not the active embedding model");
  });

  it("fails when the node is gone", async () => {
    const job = await claim();

    await database.delete(NODE_STORE, "a");

    await expect(
      runMetadataEmbeddingJob({ database, job, loadSession: buildSession().loadSession }),
    ).rejects.toThrow("no longer exists");
  });
});
