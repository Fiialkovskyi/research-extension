import "fake-indexeddb/auto";

import type { IDBPDatabase } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { deleteNode } from ".";
import { recordSnapshot } from "@/features/pageSnapshots";
import {
  CHUNK_STORE,
  EDGE_STORE,
  EXTRACTION_STORE,
  FACT_STORE,
  JOB_STORE,
  KEY_STORE,
  NODE_STORE,
  openResearchDatabase,
  type ResearchDatabaseSchema,
  SNAPSHOT_STORE,
  type StoredNode,
  VECTOR_STORE,
} from "@/shared/storage";

let database: IDBPDatabase<ResearchDatabaseSchema>;
let snapshotId = "";

const node = (id: string, overrides: Partial<StoredNode> = {}): StoredNode => ({
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
  ...overrides,
});

const vector = (spaceId: string, nodeId: string, chunkId: string) => ({
  spaceId,
  chunkId,
  part: 0,
  nodeId,
  sessionId: "session-1",
  vector: new Float32Array([1]),
});

beforeEach(async () => {
  database = await openResearchDatabase();
  await Promise.all(
    (
      [
        NODE_STORE,
        EDGE_STORE,
        SNAPSHOT_STORE,
        CHUNK_STORE,
        VECTOR_STORE,
        FACT_STORE,
        EXTRACTION_STORE,
        JOB_STORE,
        KEY_STORE,
      ] as const
    ).map((store) => database.clear(store)),
  );
  await database.put(NODE_STORE, node("a"));
  await database.put(NODE_STORE, node("b"));
  await database.put(NODE_STORE, node("c", { openerNodeId: "a", tabId: 8 }));
  snapshotId =
    (
      await recordSnapshot(database, {
        nodeId: "a",
        text: "Mid-drive motors.",
        truncated: false,
        extractorVersion: "readability@0.6.0/1",
        capturedAt: 1,
      })
    )?.id ?? "";
  await Promise.all([
    database.put(EDGE_STORE, {
      id: "a|c|opener",
      sessionId: "session-1",
      kind: "opener",
      from: "a",
      to: "c",
      weight: 1,
      createdAt: 1,
    }),
    database.put(EDGE_STORE, {
      id: "b|a|sameTab",
      sessionId: "session-1",
      kind: "sameTab",
      from: "b",
      to: "a",
      weight: 0.5,
      createdAt: 1,
    }),
    database.put(EDGE_STORE, {
      id: "b|c|opener",
      sessionId: "session-1",
      kind: "opener",
      from: "b",
      to: "c",
      weight: 1,
      createdAt: 1,
    }),
    database.put(CHUNK_STORE, {
      id: `${snapshotId}:0`,
      snapshotId,
      nodeId: "a",
      sessionId: "session-1",
      chunkerVersion: "chunker@1",
      index: 0,
      start: 0,
      end: 5,
    }),
    database.put(VECTOR_STORE, vector("space-1", "a", `${snapshotId}:0`)),
    database.put(VECTOR_STORE, vector("space-2", "a", `${snapshotId}:0`)),
    database.put(VECTOR_STORE, vector("space-1", "b", "other:0")),
    database.put(FACT_STORE, {
      id: `${snapshotId}:0:0`,
      nodeId: "a",
      sessionId: "session-1",
    } as never),
    database.put(FACT_STORE, { id: "other:0:0", nodeId: "b", sessionId: "session-1" } as never),
    database.put(EXTRACTION_STORE, { snapshotId, nodeId: "a", sessionId: "session-1" } as never),
    database.put(JOB_STORE, {
      id: "job-a",
      type: "embedSnapshot",
      sessionId: "session-1",
      inputHashes: [],
      producerVersion: "space-1",
      status: "queued",
      priority: 0,
      attempts: 0,
      nextAttemptAt: 0,
      createdAt: 0,
      updatedAt: 0,
      payload: { snapshotId, spaceId: "space-1" },
    }),
    database.put(JOB_STORE, {
      id: "job-b",
      type: "embedSnapshot",
      sessionId: "session-1",
      inputHashes: [],
      producerVersion: "space-1",
      status: "queued",
      priority: 0,
      attempts: 0,
      nextAttemptAt: 0,
      createdAt: 0,
      updatedAt: 0,
      payload: { snapshotId: "other", spaceId: "space-1" },
    }),
  ]);
});

describe("deleteNode", () => {
  it("deletes the page and everything derived from it", async () => {
    expect(await deleteNode(database, "a")).toBe(true);

    expect(await database.get(NODE_STORE, "a")).toBeUndefined();
    expect((await database.getAll(EDGE_STORE)).map(({ id }) => id)).toEqual(["b|c|opener"]);
    expect(await database.count(SNAPSHOT_STORE)).toBe(0);
    expect(await database.count(CHUNK_STORE)).toBe(0);
    expect((await database.getAll(VECTOR_STORE)).map(({ nodeId }) => nodeId)).toEqual(["b"]);
    expect((await database.getAll(JOB_STORE)).map(({ id }) => id)).toEqual(["job-b"]);
    expect((await database.getAll(FACT_STORE)).map(({ nodeId }) => nodeId)).toEqual(["b"]);
    expect(await database.count(EXTRACTION_STORE)).toBe(0);
  });

  it("keeps the pages reached from it", async () => {
    await deleteNode(database, "a");

    expect(await database.get(NODE_STORE, "c")).toMatchObject({ openerNodeId: "a" });
    expect(await database.get(NODE_STORE, "b")).toBeDefined();
  });

  it("reports a page that does not exist, deleting nothing", async () => {
    expect(await deleteNode(database, "missing")).toBe(false);
    expect(await database.count(NODE_STORE)).toBe(3);
  });
});
