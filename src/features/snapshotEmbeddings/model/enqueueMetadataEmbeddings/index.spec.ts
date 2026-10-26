import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { enqueueMetadataEmbeddings } from ".";
import { recordPageMetadata } from "@/features/pageMetadata";
import {
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
  type StoredModel,
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

const buildNode = (id: string, snapshotId?: string) => ({
  id,
  sessionId: "session-1",
  tabId: 7,
  kind: "page" as const,
  url: `https://example.org/${id}`,
  domain: "example.org",
  title: id,
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
  ...(snapshotId === undefined ? {} : { snapshotId }),
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
  await database.put(MODEL_STORE, MODEL);
});

const record = (nodeId: string, capturedAt: number) =>
  recordPageMetadata(database, { nodeId, metadata: { title: "Motors" }, capturedAt });

describe("enqueueMetadataEmbeddings", () => {
  it("queues one job for a page with metadata and no snapshot, and stores the space", async () => {
    await database.put(NODE_STORE, buildNode("a"));
    await record("a", 500);

    const jobs = await enqueueMetadataEmbeddings(database, "session-1");

    expect(jobs).toEqual([
      expect.objectContaining({
        type: "embedPageMetadata",
        payload: { nodeId: "a", spaceId: expect.any(String) },
      }),
    ]);
    expect(await database.count(SPACE_STORE)).toBe(1);
  });

  it("skips a page without metadata, and one that has a snapshot", async () => {
    await database.put(NODE_STORE, buildNode("a"));
    await database.put(NODE_STORE, buildNode("b", "snapshot-b"));
    await record("b", 500);

    expect(await enqueueMetadataEmbeddings(database, "session-1")).toEqual([]);
  });

  it("queues a page once, and again only when its metadata was read again", async () => {
    await database.put(NODE_STORE, buildNode("a"));
    await record("a", 500);
    await enqueueMetadataEmbeddings(database, "session-1");
    await enqueueMetadataEmbeddings(database, "session-1");

    expect(await database.count(JOB_STORE)).toBe(1);

    await record("a", 600);
    await enqueueMetadataEmbeddings(database, "session-1");

    expect(await database.count(JOB_STORE)).toBe(2);
  });

  it("queues nothing without an active embedding model, and fails nothing", async () => {
    await database.put(NODE_STORE, buildNode("a"));
    await record("a", 500);
    await database.put(MODEL_STORE, { ...MODEL, active: false });

    expect(await enqueueMetadataEmbeddings(database, "session-1")).toEqual([]);
  });

  it("queues nothing for a session that is not active", async () => {
    await database.put(NODE_STORE, buildNode("a"));
    await record("a", 500);
    await database.put(SESSION_STORE, {
      ...(await database.get(SESSION_STORE, "session-1")),
      status: "saved",
    } as never);

    expect(await enqueueMetadataEmbeddings(database, "session-1")).toEqual([]);
  });
});
