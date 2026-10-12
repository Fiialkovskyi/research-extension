import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { enqueueSnapshotEmbeddings } from ".";
import { completeJob } from "@/features/jobQueue";
import { recordSnapshot } from "@/features/pageSnapshots";
import {
  JOB_STORE,
  KEY_STORE,
  MODEL_STORE,
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SESSION_STORE,
  SNAPSHOT_STORE,
  SPACE_STORE,
  type StoredModel,
  type StoredNode,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;

const EMBEDDING_MODEL: StoredModel = {
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

const node = (id: string): StoredNode => ({
  id,
  sessionId: "session-1",
  tabId: 7,
  kind: "page",
  url: `https://example.org/${id}`,
  domain: "example.org",
  title: id,
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  signals: {
    activeDwellMs: 0,
    maxScroll: 0,
    copyEvents: 1,
    focusCount: 1,
    revisitCount: 0,
    quickReturnCount: 0,
  },
  tabState: "open",
  createdAt: 1,
});

const snapshotOf = (nodeId: string, text: string) =>
  recordSnapshot(database, {
    nodeId,
    text,
    truncated: false,
    extractorVersion: "readability@0.6.0/1",
    capturedAt: 1,
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
  await database.put(NODE_STORE, node("a"));
  await database.put(NODE_STORE, node("b"));
  await database.put(NODE_STORE, node("unread"));
  await snapshotOf("a", "Mid-drive motors sit at the cranks.");
  await snapshotOf("b", "Hub motors sit in the wheel.");
});

describe("enqueueSnapshotEmbeddings", () => {
  it("queues one job per snapshot into the active model's space, and stores the space", async () => {
    await database.put(MODEL_STORE, EMBEDDING_MODEL);

    const jobs = await enqueueSnapshotEmbeddings(database, 10);
    const [space] = await database.getAll(SPACE_STORE);

    expect(jobs).toHaveLength(2);
    expect(space).toMatchObject({ model: { repository: "Xenova/all-MiniLM-L6-v2" }, dims: 4 });
    expect(jobs.every((job) => job.producerVersion === space?.id)).toBe(true);
    expect(jobs.map((job) => job.payload)).toEqual(
      expect.arrayContaining([expect.objectContaining({ spaceId: space?.id })]),
    );
  });

  it("queues nothing without an active embedding model", async () => {
    await database.put(MODEL_STORE, { ...EMBEDDING_MODEL, active: false });

    expect(await enqueueSnapshotEmbeddings(database)).toEqual([]);
    expect(await database.count(JOB_STORE)).toBe(0);
  });

  it("queues nothing without an active session", async () => {
    await database.put(MODEL_STORE, EMBEDDING_MODEL);
    await database.clear(SESSION_STORE);

    expect(await enqueueSnapshotEmbeddings(database)).toEqual([]);
  });

  it("does not queue a snapshot already embedded in that space again", async () => {
    await database.put(MODEL_STORE, EMBEDDING_MODEL);

    const [first] = await enqueueSnapshotEmbeddings(database);

    await completeJob(database, first?.id ?? "");

    const again = await enqueueSnapshotEmbeddings(database);

    expect(again.find((job) => job.id === first?.id)?.status).toBe("done");
    expect(await database.count(JOB_STORE)).toBe(2);
  });
});
