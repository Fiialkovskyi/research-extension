import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runEmbeddingJob } from ".";
import { checkpointJob, claimNextJob } from "@/features/jobQueue";
import { recordSnapshot } from "@/features/pageSnapshots";
import { enqueueSnapshotEmbeddings } from "../enqueueSnapshotEmbeddings";
import {
  CHUNK_STORE,
  JOB_STORE,
  KEY_STORE,
  MODEL_STORE,
  NODE_STORE,
  openResearchDatabase,
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

/** 30 sentences of 20 words: three chunks, each split into parts for a 128-token model. */
const ARTICLE = Array.from(
  { length: 30 },
  (_, index) => `Sentence ${index + 1} ${Array.from({ length: 18 }, () => "motor").join(" ")}.`,
).join(" ");

/** A model stub: one vector per text, and a record of every call. */
const buildSession = () => {
  const calls: string[][] = [];

  return {
    calls,
    loadSession: vi.fn(() =>
      Promise.resolve({
        embed: (texts: readonly string[]) => {
          calls.push([...texts]);
          return Promise.resolve(texts.map((_, index) => new Float32Array([index, 1, 0, 0])));
        },
      }),
    ),
  };
};

/** The queued job for the snapshot, claimed as the runner would. */
const claim = async (): Promise<StoredJob> => {
  await enqueueSnapshotEmbeddings(database);

  const job = await claimNextJob(database);

  if (job === undefined) {
    throw new Error("No job was queued.");
  }

  return job;
};

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
  await database.put(NODE_STORE, {
    id: "a",
    sessionId: "session-1",
    tabId: 7,
    kind: "page",
    url: "https://example.org/a",
    domain: "example.org",
    title: "A",
    parentNodeId: null,
    openerNodeId: null,
    transitionType: "link",
    signals: {
      activeDwellMs: 0,
      maxScroll: 0,
      copyEvents: 1,
      pasteEvents: 0,
      focusCount: 1,
      revisitCount: 0,
      quickReturnCount: 0,
    },
    tabState: "open",
    createdAt: 1,
  });
  await recordSnapshot(database, {
    nodeId: "a",
    text: ARTICLE,
    truncated: false,
    extractorVersion: "readability@0.6.0/1",
    capturedAt: 1,
  });
  await database.put(MODEL_STORE, MODEL);
});

describe("runEmbeddingJob", () => {
  it("stores the chunks as ranges and a vector per part, in the job's space", async () => {
    const job = await claim();
    const { loadSession } = buildSession();
    const stored = await runEmbeddingJob({ database, job, loadSession });
    const chunks = await database.getAll(CHUNK_STORE);
    const vectors = await database.getAll(VECTOR_STORE);
    const [space] = await database.getAll(SPACE_STORE);

    expect(chunks).toHaveLength(3);
    expect(
      chunks.every((chunk) => !("text" in chunk) && chunk.chunkerVersion === "chunker@1"),
    ).toBe(true);
    expect(vectors.length).toBe(stored);
    expect(vectors.length).toBeGreaterThan(chunks.length);
    expect(vectors.every((vector) => vector.spaceId === space?.id && vector.nodeId === "a")).toBe(
      true,
    );
  });

  it("embeds in batches of 8, checkpointing after each", async () => {
    const job = await claim();
    const { calls, loadSession } = buildSession();
    const stored = await runEmbeddingJob({ database, job, loadSession });

    expect(calls.every((batch) => batch.length <= 8)).toBe(true);
    expect(calls.length).toBe(Math.ceil(stored / 8));
    expect((await database.get(JOB_STORE, job.id))?.checkpoint).toEqual({ nextPart: stored });
  });

  it("resumes after the last checkpoint", async () => {
    const job = await claim();
    const first = buildSession();
    const total = await runEmbeddingJob({ database, job, loadSession: first.loadSession });

    await database.clear(VECTOR_STORE);
    await checkpointJob(database, job.id, { nextPart: 8 });

    const resumed = buildSession();
    const stored = await runEmbeddingJob({
      database,
      job: { ...job, checkpoint: { nextPart: 8 } },
      loadSession: resumed.loadSession,
    });

    expect(stored).toBe(total - 8);
    expect(await database.count(VECTOR_STORE)).toBe(total - 8);
  });

  it("gives the session the job's space", async () => {
    const job = await claim();

    await runEmbeddingJob({ database, job, loadSession: buildSession().loadSession });

    const [space] = await database.getAll(SPACE_STORE);

    expect((await database.get(SESSION_STORE, "session-1"))?.activeEmbeddingSpaceId).toBe(
      space?.id,
    );
  });

  it("fails when the snapshot is gone, or the space's model is no longer active", async () => {
    const job = await claim();
    const { loadSession } = buildSession();

    await database.put(MODEL_STORE, { ...MODEL, active: false });
    await expect(runEmbeddingJob({ database, job, loadSession })).rejects.toThrow(
      "is not the active embedding model",
    );

    await database.put(MODEL_STORE, MODEL);
    await database.clear(SNAPSHOT_STORE);
    await expect(runEmbeddingJob({ database, job, loadSession })).rejects.toThrow(
      "no longer exists",
    );
  });
});
